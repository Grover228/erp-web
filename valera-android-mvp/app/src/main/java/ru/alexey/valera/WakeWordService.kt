package ru.alexey.valera

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import android.media.ToneGenerator
import android.speech.tts.UtteranceProgressListener
import org.json.JSONObject
import org.vosk.LibVosk
import org.vosk.LogLevel
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import org.vosk.android.StorageService
import java.util.Locale

class WakeWordService : Service(), RecognitionListener {

    private val handler = Handler(Looper.getMainLooper())
    private var model: Model? = null
    private var speechService: SpeechService? = null
    private var tts: TextToSpeech? = null
    private val assistantSpeechQueue = ArrayDeque<String>()
    private var assistantSpeechBusy = false
    private lateinit var assistantClient: ValeraAssistantClient
    private var assistantQueryListening = false
    private var assistantStreamBuffer = ""
    private var assistantResponseComplete = false
    private var previousResponseId: String? = null
    private lateinit var lightExecutor: LightVoiceExecutor
    private lateinit var erpExecutor: ErpVoiceExecutor
    private lateinit var musicExecutor: MusicVoiceExecutor
    private lateinit var appLogger: ValeraAppLogger
    private var modelLoading = false
    private var lastWakeAt = 0L
    private var wakeDecisionPending = false
    private var lastWakeHypothesis = ""
    private var wakeChimeTrack: AudioTrack? = null
    private var audioFocusRequest: android.media.AudioFocusRequest? = null
    private var cpuWakeLock: PowerManager.WakeLock? = null
    private var assistantPartialCandidate = ""
    private var assistantPartialSeenAt = 0L
    private enum class ErpDialogueState { NONE, WAIT_CUTTING_QUANTITY, CONFIRM_CUTTING_QUANTITY }
    private var erpDialogueState = ErpDialogueState.NONE
    private var pendingCuttingQuantity: Int? = null
    private var resumeErpDialogueAfterSpeech = false

    private val wakeDecisionRunnable = Runnable {
        wakeDecisionPending = false
        lastWakeHypothesis = ""
        onWakeDetected()
    }

    private val lightTimerRunnable = Runnable {
        runLightTimerNow()
    }

    private val assistantQueryTimeoutRunnable = Runnable {
        if (assistantQueryListening) {
            assistantQueryListening = false
            stopWakeDetector()
            updateNotification("Не расслышал вопрос • жду «Валера»")
            finishAssistantHandoff()
        }
    }

    private var assistantHandoffActive = false
    private var assistantRecordingSeen = false
    private var assistantSilentPolls = 0
    private var assistantHandoffStartedAt = 0L

    override fun onCreate() {
        super.onCreate()

        assistantClient = ValeraAssistantClient(this)
        appLogger = ValeraAppLogger(this)
        appLogger.log("service_start", "ok", details = diagnosticDetails())
        createChannel()
        startForeground(
            NOTIFICATION_ID,
            buildNotification("Запускаю локальный детектор…")
        )

        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_RUNNING, true)
            .apply()

        cpuWakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:voice-listener")
            .apply { setReferenceCounted(false); acquire() }

        initTts()
        lightExecutor = LightVoiceExecutor(this)
        erpExecutor = ErpVoiceExecutor(this)
        musicExecutor = MusicVoiceExecutor(this)
        restoreLightTimer()
        PwaConfig.refresh(this)
        initOfflineWakeWord()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_MUSIC_PLAY_RECORD -> {
                handleMusicCommand(MusicVoiceCommand.PlayStation(MusicVoiceCommands.record))
                return START_STICKY
            }
            ACTION_MUSIC_PAUSE -> {
                handleMusicCommand(MusicVoiceCommand.Pause)
                return START_STICKY
            }
            ACTION_MUSIC_STOP -> {
                handleMusicCommand(MusicVoiceCommand.Stop)
                return START_STICKY
            }
        }
        if (model == null && !modelLoading) {
            initOfflineWakeWord()
        } else if (
            model != null &&
            speechService == null &&
            !assistantHandoffActive
        ) {
            startContinuousListening()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        assistantClient.cancel()

        stopWakeDetector()
        lightExecutor.closeActive()
        musicExecutor.release()
        wakeChimeTrack?.release()
        wakeChimeTrack = null
        restoreMediaAfterCommand()
        runCatching { if (cpuWakeLock?.isHeld == true) cpuWakeLock?.release() }
        cpuWakeLock = null

        model?.close()
        model = null

        tts?.stop()
        tts?.shutdown()
        tts = null

        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_RUNNING, false)
            .apply()

        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun initTts() {
        initialiseTtsEngine(VoicePreferences.enginePackage(this))
    }

    private fun initialiseTtsEngine(enginePackage: String?) {
        tts?.stop()
        tts?.shutdown()
        tts = null

        val listener = TextToSpeech.OnInitListener { status ->
            if (status == TextToSpeech.SUCCESS) {
                applySelectedVoice()
                installTtsProgressListener()
            } else if (!enginePackage.isNullOrBlank()) {
                handler.post {
                    initialiseTtsEngine(null)
                }
            }
        }

        tts =
            if (enginePackage.isNullOrBlank()) {
                TextToSpeech(this, listener)
            } else {
                TextToSpeech(this, listener, enginePackage)
            }
    }

    private fun applySelectedVoice() {
        val current = tts ?: return

        current.language = Locale("ru", "RU")

        VoicePreferences.voiceName(this)?.let { voiceName ->
            current.voices
                ?.firstOrNull { it.name == voiceName }
                ?.let { current.voice = it }
        }

        current.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
    }

    private fun installTtsProgressListener() {
        tts?.setOnUtteranceProgressListener(
            object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit

                override fun onDone(utteranceId: String?) {
                    if (utteranceId?.startsWith(ASSISTANT_UTTERANCE_PREFIX) == true) {
                        handler.post {
                            assistantSpeechBusy = false
                            speakNextAssistantPhrase()
                            finishNativeAssistantIfDone()
                            if (resumeErpDialogueAfterSpeech && !assistantSpeechBusy && assistantSpeechQueue.isEmpty()) {
                                resumeErpDialogueAfterSpeech = false
                                startErpFollowupListening()
                            }
                        }
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    if (utteranceId?.startsWith(ASSISTANT_UTTERANCE_PREFIX) == true) {
                        handler.post {
                            assistantSpeechBusy = false
                            speakNextAssistantPhrase()
                        }
                    }
                }
            }
        )
    }

    private fun enqueueAssistantSpeech(textChunk: String) {
        splitForSpeech(textChunk).forEach(assistantSpeechQueue::addLast)
        speakNextAssistantPhrase()
    }

    private fun speakNextAssistantPhrase() {
        if (assistantSpeechBusy) return
        val phrase = assistantSpeechQueue.removeFirstOrNull() ?: return
        assistantSpeechBusy = true

        tts?.speak(
            phrase,
            TextToSpeech.QUEUE_ADD,
            null,
            "$ASSISTANT_UTTERANCE_PREFIX${System.nanoTime()}"
        ) ?: run {
            assistantSpeechBusy = false
        }
    }

    private fun splitForSpeech(text: String): List<String> {
        val normalized = text.replace(Regex("""\s+"""), " ").trim()
        if (normalized.isBlank()) return emptyList()

        return Regex("""(?<=[.!?…])\s+""")
            .split(normalized)
            .flatMap { sentence ->
                if (sentence.length <= ASSISTANT_SPEECH_CHUNK_CHARS) {
                    listOf(sentence)
                } else {
                    sentence.chunked(ASSISTANT_SPEECH_CHUNK_CHARS)
                }
            }
            .map(String::trim)
            .filter(String::isNotEmpty)
    }
    private fun duckMediaForCommand() {
        musicExecutor.duckForVoiceCommand()
        val audioManager = getSystemService(AudioManager::class.java)
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                val request = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(
                        android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener { }
                    .build()
                audioFocusRequest = request
                audioManager.requestAudioFocus(request)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            }
        } catch (_: Throwable) {}
    }

    private fun restoreMediaAfterCommand() {
        musicExecutor.restoreAfterVoiceCommand()
        val audioManager = getSystemService(AudioManager::class.java)
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Throwable) {}
    }

    private fun playWakeChime() {
        // Activation sound #09: 480 -> 720 -> 960 Hz. Rendered locally so the APK
        // does not depend on a binary asset. Gain is 150% of the original preview.
        try {
            wakeChimeTrack?.stop()
            wakeChimeTrack?.release()

            val sampleRate = 44_100
            val parts = listOf(480.0 to 0.070, 720.0 to 0.070, 960.0 to 0.100)
            val gapSeconds = 0.012
            val samples = ArrayList<Short>()

            parts.forEachIndexed { index, (frequency, duration) ->
                val count = (sampleRate * duration).toInt()
                for (i in 0 until count) {
                    val t = i.toDouble() / sampleRate
                    val attack = (t / 0.004).coerceIn(0.0, 1.0)
                    val decay = exp(-t / (duration * 0.55))
                    val raw = sin(2.0 * PI * frequency * t) * attack * decay
                    val boosted = (raw * 0.88 * 1.5).coerceIn(-1.0, 1.0)
                    samples.add((boosted * Short.MAX_VALUE).toInt().toShort())
                }
                if (index < parts.lastIndex) {
                    repeat((sampleRate * gapSeconds).toInt()) { samples.add(0) }
                }
            }
            repeat((sampleRate * 0.08).toInt()) { samples.add(0) }

            val pcm = ShortArray(samples.size) { samples[it] }
            wakeChimeTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    android.media.AudioFormat.Builder()
                        .setEncoding(android.media.AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(android.media.AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(pcm.size * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
                .also { track ->
                    track.write(pcm, 0, pcm.size)
                    track.setVolume(1.0f)
                    track.setNotificationMarkerPosition(pcm.size)
                    track.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
                        override fun onMarkerReached(audioTrack: AudioTrack) {
                            audioTrack.release()
                            if (wakeChimeTrack === audioTrack) wakeChimeTrack = null
                        }
                        override fun onPeriodicNotification(audioTrack: AudioTrack) = Unit
                    })
                    track.play()
                }
        } catch (_: Throwable) {}
    }

    private fun startNativeAssistantConversation() {
        duckMediaForCommand()
        playWakeChime()
        assistantHandoffActive = true
        assistantResponseComplete = false
        assistantStreamBuffer = ""
        assistantSpeechQueue.clear()
        assistantSpeechBusy = false
        assistantPartialCandidate = ""
        assistantPartialSeenAt = 0L
        stopWakeDetector()
        updateNotification("Валера слушает вопрос…")
        sendStateBroadcast(STATE_HANDOFF, "Слушаю вопрос")

        handler.postDelayed({
            val currentModel = model
            if (currentModel == null) {
                finishAssistantHandoff()
                return@postDelayed
            }

            try {
                val recognizer = Recognizer(currentModel, SAMPLE_RATE)
                assistantQueryListening = true
                speechService = SpeechService(recognizer, SAMPLE_RATE).also {
                    it.startListening(this)
                }
                handler.removeCallbacks(assistantQueryTimeoutRunnable)
                handler.postDelayed(assistantQueryTimeoutRunnable, ASSISTANT_QUERY_TIMEOUT_MS)
            } catch (exception: Throwable) {
                updateNotification("Не удалось слушать вопрос")
                sendStateBroadcast(STATE_ERROR, exception.message ?: "Ошибка микрофона")
                finishAssistantHandoff()
            }
        }, ASSISTANT_QUERY_START_DELAY_MS)
    }

    private fun inspectAssistantQuery(hypothesis: String?): Boolean {
        if (!assistantQueryListening || hypothesis.isNullOrBlank()) return false

        val text = try {
            val json = JSONObject(hypothesis)
            when {
                json.has("text") -> json.optString("text").trim()
                json.has("partial") -> json.optString("partial").trim()
                else -> ""
            }
        } catch (_: Throwable) {
            hypothesis.trim()
        }

        // A blank Vosk result is not a command. Keep listening until timeout
        // instead of routing an empty phrase to the local-only fallback.
        if (text.isBlank()) return true

        assistantQueryListening = false
        handler.removeCallbacks(assistantQueryTimeoutRunnable)
        stopWakeDetector()
        sendAssistantQuery(text)
        return true
    }

    private fun startErpFollowupListening() {
        if (!assistantHandoffActive) assistantHandoffActive = true
        stopWakeDetector()
        val currentModel = model ?: run { finishAssistantHandoff(); return }
        try {
            val recognizer = Recognizer(currentModel, SAMPLE_RATE)
            assistantQueryListening = true
            speechService = SpeechService(recognizer, SAMPLE_RATE).also { it.startListening(this) }
            handler.removeCallbacks(assistantQueryTimeoutRunnable)
            handler.postDelayed(assistantQueryTimeoutRunnable, ASSISTANT_QUERY_TIMEOUT_MS)
            updateNotification("ERP • слушаю ответ…")
        } catch (_: Throwable) {
            erpDialogueState = ErpDialogueState.NONE
            pendingCuttingQuantity = null
            finishAssistantHandoff()
        }
    }

    private fun speakErpAndListen(message: String) {
        assistantResponseComplete = false
        resumeErpDialogueAfterSpeech = true
        enqueueAssistantSpeech(message)
    }

    private fun parseRussianQuantity(raw: String): Int? {
        raw.filter { it.isDigit() }.toIntOrNull()?.let { return it }
        val words = normalize(raw).split(" ")
        val units = mapOf("один" to 1,"одна" to 1,"два" to 2,"две" to 2,"три" to 3,"четыре" to 4,"пять" to 5,"шесть" to 6,"семь" to 7,"восемь" to 8,"девять" to 9)
        val teens = mapOf("десять" to 10,"одиннадцать" to 11,"двенадцать" to 12,"тринадцать" to 13,"четырнадцать" to 14,"пятнадцать" to 15,"шестнадцать" to 16,"семнадцать" to 17,"восемнадцать" to 18,"девятнадцать" to 19)
        val tens = mapOf("двадцать" to 20,"тридцать" to 30,"сорок" to 40,"пятьдесят" to 50,"шестьдесят" to 60,"семьдесят" to 70,"восемьдесят" to 80,"девяносто" to 90)
        val hundreds = mapOf("сто" to 100,"двести" to 200,"триста" to 300,"четыреста" to 400,"пятьсот" to 500,"шестьсот" to 600,"семьсот" to 700,"восемьсот" to 800,"девятьсот" to 900)
        var total = 0; var seen = false
        for (w in words) {
            val v = hundreds[w] ?: teens[w] ?: tens[w] ?: units[w]
            if (v != null) { total += v; seen = true }
        }
        return if (seen && total > 0) total else null
    }

    private fun handleErpDialogueAnswer(text: String): Boolean {
        when (erpDialogueState) {
            ErpDialogueState.WAIT_CUTTING_QUANTITY -> {
                val quantity = parseRussianQuantity(text)
                if (quantity == null || quantity <= 0) {
                    speakErpAndListen("Не расслышал количество. Сколько штук готово?")
                } else {
                    pendingCuttingQuantity = quantity
                    erpDialogueState = ErpDialogueState.CONFIRM_CUTTING_QUANTITY
                    speakErpAndListen("Ты сказал $quantity штук. Всё верно?")
                }
                return true
            }
            ErpDialogueState.CONFIRM_CUTTING_QUANTITY -> {
                val answer = normalize(text)
                if (listOf("да","верно","правильно","подтверждаю").any { answer.contains(it) }) {
                    val quantity = pendingCuttingQuantity ?: return true
                    erpDialogueState = ErpDialogueState.NONE
                    pendingCuttingQuantity = null
                    updateNotification("ERP • завершаю раскрой…")
                    Thread {
                        val result = erpExecutor.finishCuttingAndPrint(quantity)
                        handler.post {
                            val reply = result.getOrElse { it.message ?: "Не удалось завершить раскрой." }
                            assistantResponseComplete = true
                            updateNotification(reply)
                            enqueueAssistantSpeech(reply)
                            finishNativeAssistantIfDone()
                        }
                    }.start()
                } else if (listOf("нет","неверно","не правильно","ошибка").any { answer.contains(it) }) {
                    pendingCuttingQuantity = null
                    erpDialogueState = ErpDialogueState.WAIT_CUTTING_QUANTITY
                    speakErpAndListen("Хорошо. Сколько штук готово?")
                } else {
                    speakErpAndListen("Скажи да, если количество верное, или нет, чтобы назвать заново.")
                }
                return true
            }
            ErpDialogueState.NONE -> return false
        }
    }

    private fun sendAssistantQuery(text: String) {
        appLogger.log("command_text", "recognized", recognizedText = text, details = diagnosticDetails())
        if (handleErpDialogueAnswer(text)) return
        // Commands spoken after the separate wake word ("Валера" -> chime -> command)
        // arrive here without the wake word, so parse local commands again here.
        MusicVoiceCommands.parse("валера " + text)?.let { command ->
            assistantResponseComplete = true
            assistantStreamBuffer = ""
            stopWakeDetector()
            val result = musicExecutor.execute(command)
            updateNotification(result.getOrElse { it.message ?: "Не удалось включить радио." })
            finishAssistantHandoff()
            return
        }

        LightVoiceCommands.parse("валера " + text)?.let { command ->
            assistantResponseComplete = true
            assistantStreamBuffer = ""
            lightExecutor.execute(command) { success, message ->
                handler.post {
                    announceLocalLightResult(success, message)
                    finishAssistantHandoff()
                }
            }
            return
        }

        val erpCommand = ErpVoiceCommands.parse(text)
        if (erpCommand != null) {
            appLogger.log("command_route", "matched", recognizedText = text, action = "erp:${erpCommand.javaClass.simpleName}", details = diagnosticDetails())
            if (erpCommand == ErpVoiceCommand.FinishCutting) {
                erpDialogueState = ErpDialogueState.WAIT_CUTTING_QUANTITY
                pendingCuttingQuantity = null
                updateNotification("ERP • завершение раскроя")
                speakErpAndListen("Останавливаю раскрой. Сколько штук готово?")
                return
            }
            updateNotification("Выполняю команду ERP…")
            assistantStreamBuffer = ""
            assistantResponseComplete = false
            Thread {
                val result = erpExecutor.execute(erpCommand)
                handler.post {
                    val reply = result.getOrElse { it.message ?: "Не удалось выполнить команду ERP." }
                    assistantResponseComplete = true
                    updateNotification(reply)
                    enqueueAssistantSpeech(reply)
                    finishNativeAssistantIfDone()
                }
            }.start()
            return
        }

        if (LOCAL_COMMANDS_ONLY) {
            assistantResponseComplete = true
            assistantStreamBuffer = ""
            updateNotification("Локальный режим • жду команду")
            finishAssistantHandoff()
            return
        }

        updateNotification("Думаю…")
        assistantStreamBuffer = ""
        assistantResponseComplete = false

        assistantClient.stream(
            text = text,
            previousResponseId = previousResponseId,
            onDelta = { delta ->
                handler.post { appendAssistantDelta(delta) }
            },
            onResponseId = { responseId ->
                handler.post { previousResponseId = responseId }
            },
            onDone = {
                handler.post {
                    flushAssistantStreamBuffer()
                    assistantResponseComplete = true
                    finishNativeAssistantIfDone()
                }
            },
            onError = { error ->
                handler.post {
                    assistantResponseComplete = true
                    assistantStreamBuffer = ""
                    updateNotification("Ошибка Валеры")
                    sendStateBroadcast(STATE_ERROR, error)
                    enqueueAssistantSpeech("Не получилось получить ответ.")
                    finishNativeAssistantIfDone()
                }
            }
        )
    }

    private fun appendAssistantDelta(delta: String) {
        assistantStreamBuffer += delta
        while (true) {
            val boundary = assistantStreamBuffer.indexOfFirst { it == '.' || it == '!' || it == '?' || it == '…' }
            if (boundary < 0) break

            val phrase = assistantStreamBuffer.substring(0, boundary + 1).trim()
            assistantStreamBuffer = assistantStreamBuffer.substring(boundary + 1).trimStart()
            if (phrase.isNotBlank()) enqueueAssistantSpeech(phrase)
        }

        if (assistantStreamBuffer.length >= ASSISTANT_SPEECH_CHUNK_CHARS) {
            val splitAt = assistantStreamBuffer.lastIndexOf(' ', ASSISTANT_SPEECH_CHUNK_CHARS)
                .takeIf { it > 40 } ?: ASSISTANT_SPEECH_CHUNK_CHARS
            val phrase = assistantStreamBuffer.substring(0, splitAt).trim()
            assistantStreamBuffer = assistantStreamBuffer.substring(splitAt).trimStart()
            if (phrase.isNotBlank()) enqueueAssistantSpeech(phrase)
        }
    }

    private fun flushAssistantStreamBuffer() {
        val tail = assistantStreamBuffer.trim()
        assistantStreamBuffer = ""
        if (tail.isNotBlank()) enqueueAssistantSpeech(tail)
    }

    private fun finishNativeAssistantIfDone() {
        if (
            assistantHandoffActive &&
            !assistantQueryListening &&
            assistantResponseComplete &&
            !assistantSpeechBusy &&
            assistantSpeechQueue.isEmpty()
        ) {
            finishAssistantHandoff()
        }
    }

    private fun initOfflineWakeWord() {
        if (modelLoading || model != null) return

        modelLoading = true
        LibVosk.setLogLevel(LogLevel.INFO)
        updateNotification("Готовлю офлайн-модель…")

        StorageService.unpack(
            this,
            "model-ru",
            "valera-vosk-model",
            { unpackedModel ->
                modelLoading = false
                model = unpackedModel

                if (!assistantHandoffActive) {
                    startContinuousListening()
                }
            },
            { exception ->
                modelLoading = false
                updateNotification("Ошибка офлайн-модели")
                sendStateBroadcast(
                    STATE_ERROR,
                    "Не удалось загрузить локальную модель: " +
                        (exception.message ?: "ошибка")
                )
            }
        )
    }

    private fun startContinuousListening() {
        if (speechService != null || assistantHandoffActive) return

        val currentModel = model ?: return

        try {
            val recognizer = Recognizer(
                currentModel,
                SAMPLE_RATE,
                LightVoiceCommands.grammarJson()
            )

            speechService = SpeechService(recognizer, SAMPLE_RATE).also {
                it.startListening(this)
            }

            updateNotification("Офлайн • жду «Валера»")
            sendStateBroadcast(STATE_LISTENING, "Скажи «Валера»")
            appLogger.log("listener_start", "ok", details = diagnosticDetails())
        } catch (exception: Exception) {
            appLogger.log("listener_start", "error", errorCode = exception.javaClass.simpleName, errorMessage = exception.message, details = diagnosticDetails())
            updateNotification("Ошибка микрофона")
            sendStateBroadcast(
                STATE_ERROR,
                "Не удалось запустить локальный микрофон: " +
                    (exception.message ?: "ошибка")
            )
        }
    }

    private fun stopWakeDetector() {
        speechService?.stop()
        speechService?.shutdown()
        speechService = null
    }

    private fun inspectHypothesis(hypothesis: String?) {
        if (hypothesis.isNullOrBlank() || assistantHandoffActive) return

        val phrase = try {
            val json = JSONObject(hypothesis)
            when {
                json.has("partial") -> json.optString("partial")
                json.has("text") -> json.optString("text")
                else -> ""
            }
        } catch (_: Exception) {
            hypothesis
        }

        val normalized = normalize(phrase)
        if (!normalized.contains(WAKE_WORD)) return
        appLogger.log("wake_hypothesis", "recognized", recognizedText = phrase, details = diagnosticDetails())

        val musicCommand = MusicVoiceCommands.parse(normalized)
        if (musicCommand != null) {
            handler.removeCallbacks(wakeDecisionRunnable)
            wakeDecisionPending = false
            lastWakeHypothesis = ""
            handleMusicCommand(musicCommand)
            return
        }

        val localCommand = LightVoiceCommands.parse(normalized)
        if (localCommand != null) {
            handler.removeCallbacks(wakeDecisionRunnable)
            wakeDecisionPending = false
            lastWakeHypothesis = ""
            handleLightCommand(localCommand)
            return
        }

        scheduleWakeDecision(normalized)
    }

    private fun scheduleWakeDecision(normalized: String) {
        val now = System.currentTimeMillis()
        if (now - lastWakeAt < WAKE_DEBOUNCE_MS) return

        if (normalized == lastWakeHypothesis && wakeDecisionPending) {
            return
        }

        lastWakeHypothesis = normalized
        handler.removeCallbacks(wakeDecisionRunnable)
        wakeDecisionPending = true

        val hasLightHint = LIGHT_COMMAND_HINTS.any { hint ->
            normalized.contains(hint)
        }

        handler.postDelayed(
            wakeDecisionRunnable,
            if (hasLightHint) {
                LIGHT_COMMAND_WAIT_MS
            } else {
                WAKE_ONLY_WAIT_MS
            }
        )
    }

    private fun normalize(value: String): String =
        value.lowercase(Locale("ru", "RU"))
            .replace('ё', 'е')
            .trim()

    private fun onWakeDetected() {
        val now = System.currentTimeMillis()
        if (
            assistantHandoffActive ||
            now - lastWakeAt < WAKE_DEBOUNCE_MS
        ) {
            return
        }

        handler.removeCallbacks(wakeDecisionRunnable)
        wakeDecisionPending = false
        lastWakeHypothesis = ""

        lastWakeAt = now
        appLogger.log("wake_detected", "ok", recognizedText = WAKE_WORD, action = "wake", details = diagnosticDetails())
        val shellConfig = PwaConfig.cached(this)

        sendBroadcast(
            Intent(ACTION_WAKE_DETECTED)
                .setPackage(packageName)
        )

        when (shellConfig.wakeTarget) {
            PwaConfig.TARGET_CHATGPT_DIRECT -> startNativeAssistantConversation()
            PwaConfig.TARGET_SYSTEM_ASSISTANT -> handOffToSystemAssistant(shellConfig)
            else -> runPwaWake(shellConfig)
        }

        // Подтягиваем актуальную удалённую конфигурацию уже для следующего пробуждения.
        PwaConfig.refresh(this)
    }

    private fun handleMusicCommand(command: MusicVoiceCommand) {
        val now = System.currentTimeMillis()
        if (now - lastWakeAt < WAKE_DEBOUNCE_MS) return
        lastWakeAt = now

        sendBroadcast(Intent(ACTION_WAKE_DETECTED).setPackage(packageName))
        val result = musicExecutor.execute(command)
        val reply = result.getOrElse { it.message ?: "Не удалось открыть Радио Рекорд." }
        updateNotification(reply)
        // Do not speak over the radio stream; the station audio is the confirmation.
        handler.postDelayed({ startContinuousListening() }, WAKE_RESUME_DELAY_MS)
    }

    private fun handleLightCommand(command: LightVoiceCommand) {
        val now = System.currentTimeMillis()
        if (now - lastWakeAt < WAKE_DEBOUNCE_MS) return

        lastWakeAt = now

        sendBroadcast(
            Intent(ACTION_WAKE_DETECTED)
                .setPackage(packageName)
        )

        when (command) {
            LightVoiceCommand.CancelTimer -> {
                cancelLightTimer()
                announceLocalLightResult(
                    true,
                    LightVoiceCommands.describe(command)
                )
            }

            is LightVoiceCommand.TimerOff -> {
                scheduleLightOff(command.minutes)
                announceLocalLightResult(
                    true,
                    LightVoiceCommands.describe(command)
                )
            }

            is LightVoiceCommand.PowerForMinutes -> {
                lightExecutor.execute(
                    LightVoiceCommand.Power(true)
                ) { success, message ->
                    handler.post {
                        if (success) {
                            scheduleLightOff(command.minutes)
                            announceLocalLightResult(
                                true,
                                LightVoiceCommands.describe(command)
                            )
                        } else {
                            announceLocalLightResult(false, message)
                        }
                    }
                }
            }

            else -> {
                lightExecutor.execute(command) { success, message ->
                    handler.post {
                        announceLocalLightResult(success, message)
                    }
                }
            }
        }
    }

    private fun announceLocalLightResult(
        success: Boolean,
        message: String
    ) {
        updateNotification(
            if (success) {
                "Свет • $message"
            } else {
                "Свет • ошибка"
            }
        )

        tts?.speak(
            message,
            TextToSpeech.QUEUE_FLUSH,
            null,
            "valera-light"
        )

        handler.postDelayed(
            {
                if (!assistantHandoffActive) {
                    updateNotification("Офлайн • жду «Валера»")
                    sendStateBroadcast(
                        STATE_LISTENING,
                        "Скажи «Валера»"
                    )
                }
            },
            2500L
        )
    }

    private fun scheduleLightOff(minutes: Int) {
        val dueAt =
            System.currentTimeMillis() +
                minutes.coerceAtLeast(1) * 60_000L

        getSharedPreferences(LIGHT_PREFS, MODE_PRIVATE)
            .edit()
            .putLong(KEY_LIGHT_TIMER_DUE_AT, dueAt)
            .apply()

        armLightTimer(dueAt)
    }

    private fun restoreLightTimer() {
        val dueAt = getSharedPreferences(LIGHT_PREFS, MODE_PRIVATE)
            .getLong(KEY_LIGHT_TIMER_DUE_AT, 0L)

        if (dueAt > 0L) {
            armLightTimer(dueAt)
        }
    }

    private fun armLightTimer(dueAt: Long) {
        handler.removeCallbacks(lightTimerRunnable)

        val delay = dueAt - System.currentTimeMillis()

        if (delay <= 0L) {
            handler.post(lightTimerRunnable)
        } else {
            handler.postDelayed(lightTimerRunnable, delay)
        }
    }

    private fun cancelLightTimer() {
        handler.removeCallbacks(lightTimerRunnable)

        getSharedPreferences(LIGHT_PREFS, MODE_PRIVATE)
            .edit()
            .remove(KEY_LIGHT_TIMER_DUE_AT)
            .apply()
    }

    private fun runLightTimerNow() {
        cancelLightTimer()

        lightExecutor.execute(
            LightVoiceCommand.Power(false)
        ) { success, message ->
            handler.post {
                if (success) {
                    announceLocalLightResult(
                        true,
                        "Таймер. Выключаю свет"
                    )
                } else {
                    announceLocalLightResult(false, message)
                }
            }
        }
    }

    private fun runPwaWake(shellConfig: ShellConfig) {
        updateNotification(
            if (shellConfig.openPwaOnWake && !shellConfig.assistantUrl.isNullOrBlank()) {
                "Открываю Валеру в ERP…"
            } else {
                "Услышал «Валера»"
            }
        )

        if (shellConfig.speakOnWake) {
            tts?.speak(
                "Да, Алексей. Слушаю.",
                TextToSpeech.QUEUE_FLUSH,
                null,
                "valera-wake"
            )
        }

        if (shellConfig.openPwaOnWake) {
            openAssistantPwa(shellConfig.assistantUrl)
        }

        handler.postDelayed(
            { updateNotification("Офлайн • жду «Валера»") },
            2200L
        )
    }

    private fun prepareAssistantHandoff(message: String) {
        assistantHandoffActive = true
        assistantRecordingSeen = false
        assistantSilentPolls = 0
        assistantHandoffStartedAt = System.currentTimeMillis()

        tts?.stop()
        stopWakeDetector()

        updateNotification("Освобождаю микрофон для ChatGPT…")
        sendStateBroadcast(STATE_HANDOFF, message)
    }

    private fun handOffToChatGptDirect(shellConfig: ShellConfig) {
        prepareAssistantHandoff("Открываю ChatGPT Voice напрямую")

        handler.postDelayed(
            { launchChatGptVoice(shellConfig) },
            ASSISTANT_LAUNCH_DELAY_MS
        )
    }

    private fun handOffToSystemAssistant(shellConfig: ShellConfig) {
        prepareAssistantHandoff("Открываю системный голосовой помощник")

        handler.postDelayed(
            { launchSystemAssistantVoiceCommand() },
            ASSISTANT_LAUNCH_DELAY_MS
        )
    }

    private fun launchChatGptVoice(shellConfig: ShellConfig) {
        val result = ChatGptLauncher.launch(this, shellConfig)

        if (!result.success) {
            updateNotification("ChatGPT Voice не удалось открыть")
            sendStateBroadcast(
                STATE_ERROR,
                "Не удалось открыть ChatGPT Voice: " + result.detail
            )
            finishAssistantHandoff()
            return
        }

        updateNotification(
            if (result.usedFallback) {
                "ChatGPT Voice • fallback deeplink"
            } else {
                "ChatGPT Voice • прямой запуск"
            }
        )

        handler.postDelayed(
            { monitorAssistantMicrophone() },
            ASSISTANT_FIRST_CHECK_DELAY_MS
        )
    }

    private fun launchSystemAssistantVoiceCommand() {
        val voiceIntent = Intent(Intent.ACTION_VOICE_COMMAND).apply {
            addCategory(Intent.CATEGORY_DEFAULT)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
        }

        val resolved = voiceIntent.resolveActivity(packageManager)

        if (resolved == null) {
            updateNotification("VOICE_COMMAND не поддержан • жду «Валера»")
            sendStateBroadcast(
                STATE_ERROR,
                "Android не нашёл обработчик голосового помощника"
            )
            finishAssistantHandoff()
            return
        }

        try {
            startActivity(voiceIntent)
            updateNotification("Команда передана системному помощнику")
            handler.postDelayed(
                { monitorAssistantMicrophone() },
                ASSISTANT_FIRST_CHECK_DELAY_MS
            )
        } catch (_: Throwable) {
            updateNotification("Системный помощник не запустился")
            sendStateBroadcast(
                STATE_ERROR,
                "Не удалось запустить Android VOICE_COMMAND"
            )
            finishAssistantHandoff()
        }
    }

    private fun monitorAssistantMicrophone() {
        if (!assistantHandoffActive) return

        val elapsed = System.currentTimeMillis() - assistantHandoffStartedAt
        val assistantRecording = isAnotherRecordingActive()

        if (assistantRecording) {
            assistantRecordingSeen = true
            assistantSilentPolls = 0
            updateNotification("ChatGPT слушает • Валера ждёт")
        } else if (assistantRecordingSeen) {
            assistantSilentPolls += 1

            if (assistantSilentPolls >= ASSISTANT_SILENT_POLLS_TO_RESUME) {
                finishAssistantHandoff()
                return
            }
        } else if (elapsed >= ASSISTANT_RECORDING_START_TIMEOUT_MS) {
            updateNotification("ChatGPT Voice не стартовал • жду «Валера»")
            sendStateBroadcast(
                STATE_ERROR,
                "Голосовой помощник не занял микрофон"
            )
            finishAssistantHandoff()
            return
        }

        handler.postDelayed(
            { monitorAssistantMicrophone() },
            ASSISTANT_POLL_INTERVAL_MS
        )
    }

    private fun isAnotherRecordingActive(): Boolean {
        return try {
            val audioManager = getSystemService(AudioManager::class.java)
            audioManager.activeRecordingConfigurations.isNotEmpty()
        } catch (_: Throwable) {
            false
        }
    }

    private fun finishAssistantHandoff() {
        restoreMediaAfterCommand()
        assistantHandoffActive = false
        assistantQueryListening = false
        assistantResponseComplete = false
        assistantStreamBuffer = ""
        assistantPartialCandidate = ""
        assistantPartialSeenAt = 0L
        resumeErpDialogueAfterSpeech = false
        erpDialogueState = ErpDialogueState.NONE
        pendingCuttingQuantity = null
        handler.removeCallbacks(assistantQueryTimeoutRunnable)
        assistantRecordingSeen = false
        assistantSilentPolls = 0
        assistantHandoffStartedAt = 0L

        updateNotification("Возвращаю локальный wake-word…")

        handler.postDelayed(
            { startContinuousListening() },
            WAKE_RESUME_DELAY_MS
        )
    }

    private fun openAssistantPwa(cachedUrl: String?) {
        if (!cachedUrl.isNullOrBlank()) {
            launchAssistantPwa(cachedUrl)
            return
        }

        PwaConfig.refresh(this) { refreshed ->
            if (
                refreshed.openPwaOnWake &&
                !refreshed.assistantUrl.isNullOrBlank()
            ) {
                launchAssistantPwa(refreshed.assistantUrl)
            }
        }
    }

    private fun launchAssistantPwa(url: String) {
        handler.post {
            try {
                startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                        addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_CLEAR_TOP
                        )
                    }
                )
            } catch (_: Throwable) {
                updateNotification("PWA не открылось • жду «Валера»")
            }
        }
    }

    private fun diagnosticDetails(): JSONObject {
        val powerManager = getSystemService(PowerManager::class.java)
        return JSONObject()
            .put("screen_interactive", powerManager.isInteractive)
            .put("assistant_handoff", assistantHandoffActive)
            .put("assistant_query_listening", assistantQueryListening)
            .put("wake_lock_held", cpuWakeLock?.isHeld == true)
            .put("erp_dialogue_state", erpDialogueState.name)
    }

    private fun sendStateBroadcast(state: String, message: String) {
        sendBroadcast(
            Intent(ACTION_SERVICE_STATE)
                .setPackage(packageName)
                .putExtra(EXTRA_STATE, state)
                .putExtra(EXTRA_MESSAGE, message)
        )
    }

    private fun buildNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            10,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Валера")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun createChannel() {
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Валера",
                    NotificationManager.IMPORTANCE_LOW
                )
            )
    }

    override fun onPartialResult(hypothesis: String?) {
        if (!assistantQueryListening) {
            inspectHypothesis(hypothesis)
            return
        }
        if (hypothesis.isNullOrBlank()) return
        val text = runCatching { JSONObject(hypothesis).optString("partial").trim() }.getOrDefault("")
        if (text.isBlank()) return

        // При погашенном экране Vosk на части устройств может долго не присылать
        // финальный result. Не исполняем обрывок сразу: ждём, пока одна и та же
        // известная команда стабилизируется минимум на двух partial callback.
        val known = when (erpDialogueState) {
            ErpDialogueState.NONE ->
                ErpVoiceCommands.parse(text) != null ||
                    MusicVoiceCommands.parse("валера " + text) != null ||
                    LightVoiceCommands.parse("валера " + text) != null
            else -> parseRussianQuantity(text) != null ||
                normalize(text).let { a ->
                    listOf("да","верно","правильно","подтверждаю","нет","неверно","ошибка").any { a.contains(it) }
                }
        }
        if (!known) return

        val now = System.currentTimeMillis()
        if (assistantPartialCandidate != text) {
            assistantPartialCandidate = text
            assistantPartialSeenAt = now
        } else if (now - assistantPartialSeenAt >= STABLE_PARTIAL_MS) {
            inspectAssistantQuery(JSONObject().put("text", text).toString())
        }
    }

    override fun onResult(hypothesis: String?) {
        if (!inspectAssistantQuery(hypothesis)) inspectHypothesis(hypothesis)
    }

    override fun onFinalResult(hypothesis: String?) {
        if (!inspectAssistantQuery(hypothesis)) inspectHypothesis(hypothesis)
    }

    override fun onError(exception: Exception?) {
        appLogger.log("recognizer_error", "error", errorCode = exception?.javaClass?.simpleName, errorMessage = exception?.message, details = diagnosticDetails())
        stopWakeDetector()

        if (assistantHandoffActive) {
            return
        }

        updateNotification("Перезапускаю локальный детектор…")
        handler.postDelayed({ startContinuousListening() }, 1200L)
    }

    override fun onTimeout() {
        // Для wake-word timeout не используем: слушаем одним непрерывным сеансом.
    }

    companion object {
        const val ACTION_MUSIC_PLAY_RECORD = "ru.alexey.valera.MUSIC_PLAY_RECORD"
        const val ACTION_MUSIC_PAUSE = "ru.alexey.valera.MUSIC_PAUSE"
        const val ACTION_MUSIC_STOP = "ru.alexey.valera.MUSIC_STOP"
        const val ACTION_WAKE_DETECTED = "ru.alexey.valera.WAKE_DETECTED"
        const val ACTION_SERVICE_STATE = "ru.alexey.valera.SERVICE_STATE"
        const val EXTRA_STATE = "state"
        const val EXTRA_MESSAGE = "message"

        const val STATE_LISTENING = "listening"
        const val STATE_ERROR = "error"
        const val STATE_HANDOFF = "handoff"

        const val PREFS = "valera"
        const val KEY_RUNNING = "wake_service_running"

        // Temporary: retain ChatGPT streaming code, but do not send microphone speech to it.
        private const val LOCAL_COMMANDS_ONLY = true
        private const val CHANNEL_ID = "valera"
        private const val NOTIFICATION_ID = 1
        private const val WAKE_WORD = "валера"
        private const val SAMPLE_RATE = 16000.0f
        private const val WAKE_DEBOUNCE_MS = 3000L
        private const val WAKE_ONLY_WAIT_MS = 1200L
        private const val LIGHT_COMMAND_WAIT_MS = 1800L

        private val LIGHT_COMMAND_HINTS = listOf(
            "свет",
            "лент",
            "ярк",
            "таймер",
            "включ",
            "выключ",
            "красн",
            "зелен",
            "син",
            "бел",
            "фиолет",
            "желт",
            "оранж",
            "розов",
            "голуб",
            "бирюз"
        )

        private const val LIGHT_PREFS = "valera-light"
        private const val KEY_LIGHT_TIMER_DUE_AT = "voice_timer_due_at"

        private const val ASSISTANT_LAUNCH_DELAY_MS = 450L
        private const val ASSISTANT_FIRST_CHECK_DELAY_MS = 3500L
        private const val ASSISTANT_POLL_INTERVAL_MS = 1500L
        private const val ASSISTANT_RECORDING_START_TIMEOUT_MS = 15000L
        private const val ASSISTANT_SILENT_POLLS_TO_RESUME = 5
        private const val WAKE_RESUME_DELAY_MS = 1200L
        private const val ASSISTANT_UTTERANCE_PREFIX = "valera-assistant-"
        private const val ASSISTANT_SPEECH_CHUNK_CHARS = 180
        private const val ASSISTANT_QUERY_START_DELAY_MS = 250L
        private const val ASSISTANT_QUERY_TIMEOUT_MS = 12_000L
        private const val STABLE_PARTIAL_MS = 220L
    }
}
