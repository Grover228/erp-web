package ru.alexey.valera

import android.app.*
import android.content.Intent
import android.media.AudioManager
import android.os.IBinder

class WakeWordService : Service() {
    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(1, Notification.Builder(this, "valera")
            .setContentTitle("Валера")
            .setContentText("Слушаю ключевое слово «Валера»")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .build())

        val audioManager = getSystemService(AudioManager::class.java)
        audioManager.mode = AudioManager.MODE_NORMAL

        // TODO: local wake word, Realtime voice session and secure ERP tools.
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel("valera", "Валера", NotificationManager.IMPORTANCE_LOW)
        )
    }
}
