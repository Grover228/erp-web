package ru.alexey.valera

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import java.util.Locale

class WakeWordService : Service(), RecognitionListener {

    private val handler = Handler(Looper.getMainLooper())
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private var lastWakeAt = 0L
    private var tts: TextToSpeech? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Слушаю слово «Валера»"))
        initTts()
        initRecognizer()
        handler.postDelayed({ startListening() }, 350)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startListening()
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        speechRecognizer?.cancel()
        speechRecognizer?.destroy()
        speechRecognizer = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun initRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            updateNotification("Распознавание речи недоступно")
            return
        }

        speechRecognizer = if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(this)
        ) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        } else {
            SpeechRecognizer.createSpeechRecognizer(this)
        }.also {
            it.setRecognitionListener(this)
        }
    }

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale("ru", "RU")
            }
        }
    }

    private fun recognitionIntent(): Intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
        }

    private fun startListening() {
        if (isListening || speechRecognizer == null) return

        try {
            isListening = true
            speechRecognizer?.startListening(recognitionIntent())
            updateNotification("Слушаю слово «Валера»")
        } catch (_: Throwable) {
            isListening = false
            scheduleRestart(900)
        }
    }

    private fun scheduleRestart(delayMs: Long = 450) {
        handler.removeCallbacks(restartRunnable)
        handler.postDelayed(restartRunnable, delayMs)
    }

    private val restartRunnable = Runnable {
        isListening = false
        startListening()
    }

    private fun inspectResults(bundle: Bundle?, partial: Boolean) {
        val phrases = bundle
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            .orEmpty()

        val heardWakeWord = phrases.any { phrase ->
            normalize(phrase).contains("валера")
        }

        if (heardWakeWord) {
            onWakeDetected()
        } else if (!partial) {
            isListening = false
            scheduleRestart()
        }
    }

    private fun normalize(value: String): String =
        value.lowercase(Locale("ru", "RU"))
            .replace('ё', 'е')
            .trim()

    private fun onWakeDetected() {
        val now = System.currentTimeMillis()
        if (now - lastWakeAt < 2500) return
        lastWakeAt = now

        isListening = false
        speechRecognizer?.stopListening()

        updateNotification("Услышал «Валера»")
        sendBroadcast(
            Intent(ACTION_WAKE_DETECTED)
                .setPackage(packageName)
        )

        val openApp = Intent(this, MainActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
            putExtra(EXTRA_WAKE_DETECTED, true)
        }

        try {
            startActivity(openApp)
        } catch (_: Throwable) {
            // Android may block background activity launches on some devices.
            // The persistent notification remains available as a fallback.
        }

        tts?.speak(
            "Да, Алексей. Слушаю.",
            TextToSpeech.QUEUE_FLUSH,
            null,
            "valera-wake"
        )

        scheduleRestart(2200)
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            10,
            openIntent,
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

    override fun onReadyForSpeech(params: Bundle?) = Unit
    override fun onBeginningOfSpeech() = Unit
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit
    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    override fun onError(error: Int) {
        isListening = false
        val delay = when (error) {
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> 1200L
            SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> 2500L
            else -> 650L
        }
        scheduleRestart(delay)
    }

    override fun onResults(results: Bundle?) {
        inspectResults(results, partial = false)
    }

    override fun onPartialResults(partialResults: Bundle?) {
        inspectResults(partialResults, partial = true)
    }

    companion object {
        const val ACTION_WAKE_DETECTED = "ru.alexey.valera.WAKE_DETECTED"
        const val EXTRA_WAKE_DETECTED = "wake_detected"

        private const val CHANNEL_ID = "valera"
        private const val NOTIFICATION_ID = 1
    }
}
