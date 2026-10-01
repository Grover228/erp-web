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
    private lateinit var startButton: Button

    private val wakeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != WakeWordService.ACTION_WAKE_DETECTED) return
            orb.setState(ValeraOrbView.State.AWAKE)
            status.text = "Да, Алексей. Слушаю."
            orb.postDelayed({
                orb.setState(ValeraOrbView.State.LISTENING)
                status.text = "Скажи «Валера»"
            }, 1800)
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
            setPadding(24, 24, 24, 24)
        }

        val hint = TextView(this).apply {
            text = "После запуска можно свернуть приложение и сказать «Валера»."
            textSize = 15f
            setTextColor(Color.rgb(170, 180, 205))
            gravity = Gravity.CENTER
            setPadding(24, 0, 24, 28)
        }

        startButton = Button(this).apply {
            text = "Включить Валеру"
            setOnClickListener { ensurePermissionsAndStart() }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.rgb(7, 10, 19))
            setPadding(32, 48, 32, 40)
            addView(orb)
            addView(status)
            addView(hint)
            addView(
                startButton,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            )
        }

        setContentView(root)
        handleWakeIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        ContextCompat.registerReceiver(
            this,
            wakeReceiver,
            IntentFilter(WakeWordService.ACTION_WAKE_DETECTED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onStop() {
        unregisterReceiver(wakeReceiver)
        super.onStop()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleWakeIntent(intent)
    }

    private fun handleWakeIntent(intent: Intent?) {
        if (intent?.getBooleanExtra(WakeWordService.EXTRA_WAKE_DETECTED, false) == true) {
            orb.setState(ValeraOrbView.State.AWAKE)
            status.text = "Да, Алексей. Слушаю."
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

        startValera()
    }

    private fun startValera() {
        ContextCompat.startForegroundService(
            this,
            Intent(this, WakeWordService::class.java)
        )
        orb.setState(ValeraOrbView.State.LISTENING)
        status.text = "Скажи «Валера»"
        startButton.text = "Валера включён"
        startButton.isEnabled = false
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
