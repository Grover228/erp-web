package ru.alexey.valera

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.tts.TextToSpeech
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
    private var modelLoading = false
    private var lastWakeAt = 0L

    override fun onCreate() {
        super.onCreate()

        createChannel()
        startForeground(
            NOTIFICATION_ID,
            buildNotification("Запускаю локальный детектор…")
        )

        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_RUNNING, true)
            .apply()

        initTts()
        initOfflineWakeWord()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (model == null && !modelLoading) {
            initOfflineWakeWord()
        } else if (model != null && speechService == null) {
            startContinuousListening()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)

        speechService?.stop()
        speechService?.shutdown()
        speechService = null

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
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale("ru", "RU")
                tts?.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
            }
        }
    }

    private fun initOfflineWakeWord() {
        if (modelLoading || model != null) return

        modelLoading = true
        LibVosk.setLogLevel(LogLevel.WARN)
        updateNotification("Готовлю офлайн-модель…")

        StorageService.unpack(
            this,
            "model-ru",
            "valera-vosk-model",
            { unpackedModel ->
                modelLoading = false
                model = unpackedModel
                startContinuousListening()
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
        if (speechService != null) return

        val currentModel = model ?: return

        try {
            val recognizer = Recognizer(
                currentModel,
                SAMPLE_RATE,
                "[\"валера\", \"[unk]\"]"
            )

            speechService = SpeechService(recognizer, SAMPLE_RATE).also {
                it.startListening(this)
            }

            updateNotification("Офлайн • жду «Валера»")
            sendStateBroadcast(STATE_LISTENING, "Скажи «Валера»")
        } catch (exception: Exception) {
            updateNotification("Ошибка микрофона")
            sendStateBroadcast(
                STATE_ERROR,
                "Не удалось запустить локальный микрофон: " +
                    (exception.message ?: "ошибка")
            )
        }
    }

    private fun inspectHypothesis(hypothesis: String?) {
        if (hypothesis.isNullOrBlank()) return

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

        if (normalize(phrase).contains(WAKE_WORD)) {
            onWakeDetected()
        }
    }

    private fun normalize(value: String): String =
        value.lowercase(Locale("ru", "RU"))
            .replace('ё', 'е')
            .trim()

    private fun onWakeDetected() {
        val now = System.currentTimeMillis()
        if (now - lastWakeAt < WAKE_DEBOUNCE_MS) return
        lastWakeAt = now

        updateNotification("Услышал «Валера»")
        sendBroadcast(
            Intent(ACTION_WAKE_DETECTED)
                .setPackage(packageName)
        )

        tts?.speak(
            "Да, Алексей. Слушаю.",
            TextToSpeech.QUEUE_FLUSH,
            null,
            "valera-wake"
        )

        handler.postDelayed(
            { updateNotification("Офлайн • жду «Валера»") },
            1800L
        )
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
        inspectHypothesis(hypothesis)
    }

    override fun onResult(hypothesis: String?) {
        inspectHypothesis(hypothesis)
    }

    override fun onFinalResult(hypothesis: String?) {
        inspectHypothesis(hypothesis)
    }

    override fun onError(exception: Exception?) {
        speechService?.stop()
        speechService?.shutdown()
        speechService = null

        updateNotification("Перезапускаю локальный детектор…")
        handler.postDelayed({ startContinuousListening() }, 1200L)
    }

    override fun onTimeout() {
        // Для wake-word timeout не используем: слушаем одним непрерывным сеансом.
    }

    companion object {
        const val ACTION_WAKE_DETECTED = "ru.alexey.valera.WAKE_DETECTED"
        const val ACTION_SERVICE_STATE = "ru.alexey.valera.SERVICE_STATE"
        const val EXTRA_STATE = "state"
        const val EXTRA_MESSAGE = "message"

        const val STATE_LISTENING = "listening"
        const val STATE_ERROR = "error"

        const val PREFS = "valera"
        const val KEY_RUNNING = "wake_service_running"

        private const val CHANNEL_ID = "valera"
        private const val NOTIFICATION_ID = 1
        private const val WAKE_WORD = "валера"
        private const val SAMPLE_RATE = 16000.0f
        private const val WAKE_DEBOUNCE_MS = 3000L
    }
}
