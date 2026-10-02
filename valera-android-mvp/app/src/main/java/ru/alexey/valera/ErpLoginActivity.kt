package ru.alexey.valera

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

class ErpLoginActivity : Activity() {
    private lateinit var auth: ErpAuthManager
    private lateinit var status: TextView
    private lateinit var email: EditText
    private lateinit var password: EditText
    private lateinit var button: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = ErpAuthManager(this)

        email = EditText(this).apply { hint = "Email ERP"; inputType = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY) }
        password = EditText(this).apply { hint = "Пароль ERP"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY) }
        status = TextView(this).apply { text = if (auth.isConnected()) "ERP подключена" else "Войди под своей учётной записью ERP"; setTextColor(Color.WHITE); gravity = Gravity.CENTER }
        button = Button(this).apply {
            text = if (auth.isConnected()) "ПЕРЕПОДКЛЮЧИТЬ ERP" else "ПОДКЛЮЧИТЬ ERP"
            setOnClickListener { login() }
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(40, 40, 40, 40); setBackgroundColor(Color.rgb(7,10,19))
            addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 24 })
            addView(email); addView(password); addView(button)
        }
        setContentView(root)
    }

    private fun login() {
        val e = email.text.toString().trim()
        val p = password.text.toString()
        if (e.isBlank() || p.isBlank()) { status.text = "Введи email и пароль ERP"; return }
        button.isEnabled = false
        status.text = "Подключаю ERP…"
        Thread {
            val result = auth.signIn(e, p)
            runOnUiThread {
                button.isEnabled = true
                result.onSuccess {
                    status.text = "ERP подключена"
                    setResult(RESULT_OK)
                    finish()
                }.onFailure { status.text = it.message ?: "Не удалось подключить ERP" }
            }
        }.start()
    }
}
