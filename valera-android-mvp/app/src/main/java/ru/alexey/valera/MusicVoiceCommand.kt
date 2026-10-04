package ru.alexey.valera

import java.util.Locale

sealed class MusicVoiceCommand {
    data class PlayStation(val station: RadioStation) : MusicVoiceCommand()
    data object Stop : MusicVoiceCommand()
    data object Pause : MusicVoiceCommand()
    data object Resume : MusicVoiceCommand()
}

data class RadioStation(val name: String, val streamUrl: String)

object MusicVoiceCommands {
    val record = RadioStation("Рекорд", "https://radiorecord.hostingradio.ru/rr_main128.mp3")
    val chillout = RadioStation("Chill-Out", "https://radiorecord.hostingradio.ru/chil128.mp3")
    val lofi = RadioStation("Lo-Fi", "https://radiorecord.hostingradio.ru/lofi128.mp3")
    fun parse(rawText: String): MusicVoiceCommand? {
        val text = normalize(rawText)
        if (!text.contains("валера")) return null
        val command = text.substringAfter("валера").trim()
        if (command in listOf("выключи музыку", "останови музыку", "выключи радио", "стоп музыка")) return MusicVoiceCommand.Stop
        if (command in listOf("пауза", "поставь музыку на паузу")) return MusicVoiceCommand.Pause
        if (command in listOf("продолжи музыку", "продолжай музыку", "включи дальше")) return MusicVoiceCommand.Resume

        return when (command) {
            "включи музыку", "включить музыку", "включи рекорд", "включи радио", "включи радио рекорд", "запусти радио рекорд" -> MusicVoiceCommand.PlayStation(record)
            "включи чилаут", "включи чил аут" -> MusicVoiceCommand.PlayStation(chillout)
            "включи лоуфай", "включи лоу фай" -> MusicVoiceCommand.PlayStation(lofi)
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
