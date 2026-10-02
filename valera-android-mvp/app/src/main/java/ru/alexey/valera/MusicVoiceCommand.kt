package ru.alexey.valera

import java.util.Locale

sealed class MusicVoiceCommand {
    data object PlayRadioRecord : MusicVoiceCommand()
}

object MusicVoiceCommands {
    fun parse(rawText: String): MusicVoiceCommand? {
        val text = normalize(rawText)
        if (!text.contains("валера")) return null
        val command = text.substringAfter("валера").trim()
        return when (command) {
            "включи музыку",
            "включить музыку",
            "включи радио",
            "включи радио рекорд",
            "запусти радио рекорд" -> MusicVoiceCommand.PlayRadioRecord
            else -> null
        }
    }

    private fun normalize(value: String): String =
        value.lowercase(Locale("ru", "RU"))
            .replace('ё', 'е')
            .replace(Regex("""[^а-я0-9\s]"""), " ")
            .replace(Regex("""\s+"""), " ")
            .trim()
}
