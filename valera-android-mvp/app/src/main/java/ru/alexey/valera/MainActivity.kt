package ru.alexey.valera

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat

class MainActivity : Activity() {

    private lateinit var status: TextView
    private lateinit var orb: ValeraOrbView
    private lateinit var toggleButton: Button
    private lateinit var modeText: TextView

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                WakeWordService.ACTION_WAKE_DETECTED -> {
                    orb.setState(ValeraOrbView.State.AWAKE)
                    status.text = "Да, Алексей. Слушаю."
                    orb.postDelayed({
                        if (isServiceMarkedRunning()) {
                            orb.setState(ValeraOrbView.State.LISTENING)
                            status.text = "Скажи «Валера»"
                        }
                    }, 1800L)
                }

                WakeWordService.ACTION_SERVICE_STATE -> {
                    when (intent.getStringExtra(WakeWordService.EXTRA_STATE)) {
                        WakeWordService.STATE_LISTENING -> {
                            orb.setState(ValeraOrbView.State.LISTENING)
                            status.text = intent.getStringExtra(
                                WakeWordService.EXTRA_MESSAGE
                            ) ?: "Скажи «Валера»"
                            modeText.text = "Локальный офлайн-детектор активен"
                            refreshButton()
                        }

                        WakeWordService.STATE_HANDOFF -> {
                            orb.setState(ValeraOrbView.State.AWAKE)
                            status.text = intent.getStringExtra(
                                WakeWordService.EXTRA_MESSAGE
                            ) ?: "Открываю ChatGPT Voice"
                            modeText.text = "Проверяю запуск ChatGPT Voice"
                        }

                        WakeWordService.STATE_ERROR -> {
                            orb.setState(ValeraOrbView.State.WAITING)
                            status.text = intent.getStringExtra(
                                WakeWordService.EXTRA_MESSAGE
                            ) ?: "Ошибка"
                            modeText.text = "Локальный детектор не запущен"
                        }
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        orb = ValeraOrbView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
            setState(ValeraOrbView.State.WAITING)
        }

        status = TextView(this).apply {
            text = "Нажми «Включить Валеру»"
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(24, 24, 24, 12)
        }

        modeText = TextView(this).apply {
            text = "Версия 0.6.0 • локальный wake-word • Android VOICE_COMMAND"
            textSize = 14f
            setTextColor(Color.rgb(160, 175, 205))
            gravity = Gravity.CENTER
            setPadding(24, 0, 24, 24)
        }

        toggleButton = Button(this).apply {
            setOnClickListener {
                if (isServiceMarkedRunning()) {
                    stopValera()
                } else {
                    ensurePermissionsAndStart()
                }
            }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.rgb(7, 10, 19))
            setPadding(32, 48, 32, 40)
            addView(orb)
            addView(status)
            addView(modeText)
            addView(
                toggleButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            )
        }

        setContentView(root)
        refreshFromStoredState()
        PwaConfig.refresh(this) {
            refreshFromStoredState()
        }
    }

    override fun onStart() {
        super.onStart()

        val filter = IntentFilter().apply {
            addAction(WakeWordService.ACTION_WAKE_DETECTED)
            addAction(WakeWordService.ACTION_SERVICE_STATE)
        }

        ContextCompat.registerReceiver(
            this,
            receiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        refreshFromStoredState()
    }

    override fun onStop() {
        unregisterReceiver(receiver)
        super.onStop()
    }

    private fun ensurePermissionsAndStart() {
        val permissions = mutableListOf<String>()

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions += Manifest.permission.RECORD_AUDIO
        }

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            permissions += Manifest.permission.POST_NOTIFICATIONS
        }

        if (permissions.isNotEmpty()) {
            requestPermissions(permissions.toTypedArray(), 100)
            return
        }

        startValera()
    }

    private fun startValera() {
        status.text = "Готовлю локальный детектор…"
        modeText.text = "Первый запуск может занять несколько секунд"

        ContextCompat.startForegroundService(
            this,
            Intent(this, WakeWordService::class.java)
        )

        toggleButton.text = "Отключить Валеру"
    }

    private fun stopValera() {
        stopService(Intent(this, WakeWordService::class.java))

        getSharedPreferences(WakeWordService.PREFS, MODE_PRIVATE)
            .edit()
            .putBoolean(WakeWordService.KEY_RUNNING, false)
            .apply()

        orb.setState(ValeraOrbView.State.WAITING)
        status.text = "Валера отключён"
        modeText.text = "Версия 0.6.0 • локальный wake-word • системный помощник"
        refreshButton()
    }

    private fun isServiceMarkedRunning(): Boolean =
        getSharedPreferences(WakeWordService.PREFS, MODE_PRIVATE)
            .getBoolean(WakeWordService.KEY_RUNNING, false)

    private fun refreshFromStoredState() {
        val shell = PwaConfig.cached(this)

        val targetState =
            if (shell.wakeTarget == PwaConfig.TARGET_SYSTEM_ASSISTANT) {
                "ChatGPT • Android VOICE_COMMAND"
            } else if (!shell.assistantUrl.isNullOrBlank()) {
                "ERP PWA"
            } else {
                "PWA ждёт адрес"
            }

        if (isServiceMarkedRunning()) {
            orb.setState(ValeraOrbView.State.LISTENING)
            status.text = "Скажи «Валера»"
            modeText.text = "Локальный wake-word • " + targetState
        } else {
            orb.setState(ValeraOrbView.State.WAITING)
            status.text = "Нажми «Включить Валеру»"
            modeText.text = "Версия 0.6.0 • " + targetState
        }
        refreshButton()
    }

    private fun refreshButton() {
        toggleButton.text =
            if (isServiceMarkedRunning()) "Отключить Валеру"
            else "Включить Валеру"
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (
            requestCode == 100 &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        ) {
            startValera()
        } else if (requestCode == 100) {
            status.text = "Нужен доступ к микрофону"
        }
    }
}
