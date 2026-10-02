package ru.alexey.valera

import android.content.Context
import android.content.Intent

class MusicVoiceExecutor(private val context: Context) {
    fun execute(command: MusicVoiceCommand): Result<String> = runCatching {
        when (command) {
            MusicVoiceCommand.PlayRadioRecord -> openRadioRecord()
        }
    }

    private fun openRadioRecord(): String {
        val packageName = "com.infoshell.recradio"
        val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: throw IllegalStateException("Приложение Радио Рекорд не установлено.")

        context.startActivity(
            launchIntent.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
        )
        return "Включаю Радио Рекорд."
    }
}
