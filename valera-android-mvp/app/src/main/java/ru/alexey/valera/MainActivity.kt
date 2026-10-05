package ru.alexey.valera

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.provider.Settings
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
    private lateinit var lightButton: Button
    private lateinit var voiceButton: Button
    private lateinit var chatGptButton: Button
    private lateinit var erpButton: Button
    private lateinit var musicExecutor: MusicVoiceExecutor
    private lateinit var chatGptAuth: ChatGptAuthManager
    private lateinit var modeText: TextView
    private var waitingForOverlayPermission = false

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
                            modeText.text = "Микрофон освобождён • запускаю ChatGPT Voice"
                        }

                        WakeWordService.STATE_ERROR -> {
                            orb.setState(ValeraOrbView.State.WAITING)
                            status.text = "Ошибка подключения к Валере"
                            modeText.text = intent.getStringExtra(WakeWordService.EXTRA_MESSAGE) ?: "Проверь подключение ChatGPT"
                        }
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        chatGptAuth = ChatGptAuthManager(this)
        musicExecutor = MusicVoiceExecutor(this)

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
            text = "Версия 1.0 • локальный wake-word • ChatGPT Voice direct"
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

        lightButton = Button(this).apply {
            text = "СВЕТ • BLE"
            setOnClickListener {
                startActivity(
                    Intent(
                        this@MainActivity,
                        LightControlActivity::class.java
                    )
                )
            }
        }

        voiceButton = Button(this).apply {
            text = "ГОЛОС И ЗВУК"
            setOnClickListener {
                openVoiceSetup()
            }
        }

        val musicTitle = TextView(this).apply {
            text = "РАДИО RECORD"
            textSize = 16f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 18, 0, 6)
        }
        val musicControls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            val play = Button(this@MainActivity).apply {
                text = "▶ RECORD"
                setOnClickListener {
                    val result = musicExecutor.execute(MusicVoiceCommand.PlayStation(MusicVoiceCommands.record))
                    status.text = result.getOrElse { it.message ?: "Ошибка радио" }
                }
            }
            val pause = Button(this@MainActivity).apply {
                text = "⏸"
                setOnClickListener { status.text = musicExecutor.execute(MusicVoiceCommand.Pause).getOrDefault("Ошибка") }
            }
            val stop = Button(this@MainActivity).apply {
                text = "■"
                setOnClickListener { status.text = musicExecutor.execute(MusicVoiceCommand.Stop).getOrDefault("Ошибка") }
            }
            addView(play, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 2f))
            addView(pause, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(stop, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }

        erpButton = Button(this).apply {
            text = if (ErpAuthManager(this@MainActivity).isConnected()) "ERP ПОДКЛЮЧЕНА" else "ПОДКЛЮЧИТЬ ERP"
            setOnClickListener {
                startActivity(Intent(this@MainActivity, ErpLoginActivity::class.java))
            }
        }

        chatGptButton = Button(this).apply {
            text = if (chatGptAuth.isConnected()) "CHATGPT ПОДКЛЮЧЁН" else "ПРОДОЛЖИТЬ С CHATGPT"
            setOnClickListener {
                isEnabled = false
                status.text = "Открываю вход в ChatGPT…"
                chatGptAuth.beginSignIn(
                    onStatus = { message -> runOnUiThread { status.text = message } },
                    onDone = { ok, message ->
                        runOnUiThread {
                            status.text = message
                            isEnabled = true
                            text = if (ok) "CHATGPT ПОДКЛЮЧЁН" else "ПРОДОЛЖИТЬ С CHATGPT"
                            if (ok) modeText.text = "ChatGPT Plus • подключено"
                        }
                    }
                )
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
            addView(
                lightButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = 12
                }
            )
            addView(
                voiceButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = 12
                }
            )
            addView(musicTitle)
            addView(musicControls)
            addView(
                erpButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = 12 }
            )
            addView(
                chatGptButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = 12
                }
            )
        }

        setContentView(root)
        refreshFromStoredState()

        if (!VoicePreferences.isConfigured(this)) {
            openVoiceSetup()
        }

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
        if (::erpButton.isInitialized) {
            erpButton.text = if (ErpAuthManager(this).isConnected()) "ERP ПОДКЛЮЧЕНА" else "ПОДКЛЮЧИТЬ ERP"
        }
    }

    override fun onStop() {
        unregisterReceiver(receiver)
        super.onStop()
    }

    override fun onResume() {
        super.onResume()

        if (
            waitingForOverlayPermission &&
            Settings.canDrawOverlays(this)
        ) {
            waitingForOverlayPermission = false
            ensurePermissionsAndStart()
        } else if (waitingForOverlayPermission) {
            status.text = "Разреши «Поверх других приложений»"
            modeText.text = "Без этого Android блокирует запуск ChatGPT из фона"
        }
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

        if (!Settings.canDrawOverlays(this)) {
            waitingForOverlayPermission = true
            status.text = "Нужно разрешение «Поверх других приложений»"
            modeText.text = "Открою системную настройку для Валеры"

            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
            )
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
        modeText.text = "Версия 1.0 • локальный wake-word • ChatGPT Voice direct"
        refreshButton()
    }

    private fun isServiceMarkedRunning(): Boolean =
        getSharedPreferences(WakeWordService.PREFS, MODE_PRIVATE)
            .getBoolean(WakeWordService.KEY_RUNNING, false)

    private fun refreshFromStoredState() {
        val shell = PwaConfig.cached(this)

        val targetState =
            when (shell.wakeTarget) {
                PwaConfig.TARGET_CHATGPT_DIRECT -> "ChatGPT Voice • прямой запуск"
                PwaConfig.TARGET_SYSTEM_ASSISTANT -> "ChatGPT • системный помощник"
                else -> if (!shell.assistantUrl.isNullOrBlank()) {
                    "ERP PWA"
                } else {
                    "PWA ждёт адрес"
                }
            }

        if (!Settings.canDrawOverlays(this)) {
            orb.setState(ValeraOrbView.State.WAITING)
            status.text = "Нужно разрешение «Поверх других приложений»"
            modeText.text = "Нажми «Включить Валеру», чтобы открыть настройку"
        } else if (isServiceMarkedRunning()) {
            orb.setState(ValeraOrbView.State.LISTENING)
            status.text = "Скажи «Валера»"
            modeText.text = "Локальный wake-word • " + targetState
        } else {
            orb.setState(ValeraOrbView.State.WAITING)
            status.text = "Нажми «Включить Валеру»"
            modeText.text = "Версия 1.0 • " + targetState
        }
        refreshButton()
    }

    private fun refreshButton() {
        toggleButton.text =
            if (isServiceMarkedRunning()) "Отключить Валеру"
            else "Включить Валеру"
    }

    private fun openVoiceSetup() {
        startActivityForResult(
            Intent(this, VoiceSetupActivity::class.java),
            REQUEST_VOICE_SETUP
        )
    }

    @Deprecated("Deprecated in Android API")
    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        super.onActivityResult(requestCode, resultCode, data)

        if (
            requestCode == REQUEST_VOICE_SETUP &&
            resultCode == RESULT_OK
        ) {
            val wasRunning = isServiceMarkedRunning()

            if (wasRunning) {
                stopService(Intent(this, WakeWordService::class.java))
                getSharedPreferences(
                    WakeWordService.PREFS,
                    MODE_PRIVATE
                )
                    .edit()
                    .putBoolean(WakeWordService.KEY_RUNNING, false)
                    .apply()

                ContextCompat.startForegroundService(
                    this,
                    Intent(this, WakeWordService::class.java)
                )
            }

            refreshFromStoredState()
        }
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
            ensurePermissionsAndStart()
        } else if (requestCode == 100) {
            status.text = "Нужен доступ к микрофону"
        }
    }

    companion object {
        private const val REQUEST_VOICE_SETUP = 210
    }
}
