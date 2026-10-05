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
    val record = RadioStation("Рекорд", "https://radiorecord.hostingradio.ru/rr_main96.aacp")
    val chillout = RadioStation("Chill-Out", "https://radiorecord.hostingradio.ru/chil96.aacp")
    val lofi = RadioStation("Lo-Fi", "https://radiorecord.hostingradio.ru/lofi96.aacp")
    fun parse(rawText: String): MusicVoiceCommand? {
        val text = normalize(rawText)
        val command = if ("валера" in text) text.substringAfter("валера").trim() else text
        if (command.isBlank()) return null

        val isRadio = listOf("радио", "музык", "рекорд", "record", "чил", "лоу").any { it in command }
        if (("выключ" in command || "останов" in command || command.startsWith("стоп")) && isRadio) return MusicVoiceCommand.Stop
        if ("пауз" in command && (isRadio || command == "пауза")) return MusicVoiceCommand.Pause
        if (("продолж" in command || "возобнов" in command || "включи дальше" in command) && (isRadio || "дальше" in command)) return MusicVoiceCommand.Resume

        val wantsPlay = listOf("включ", "запуст", "постав", "играй").any { it in command } ||
            command in listOf("рекорд", "радио", "музыка", "чилаут", "чил аут", "лоуфай", "лоу фай")

        if (!wantsPlay) return null
        return when {
            "чил" in command -> MusicVoiceCommand.PlayStation(chillout)
            "лоу" in command -> MusicVoiceCommand.PlayStation(lofi)
            isRadio -> MusicVoiceCommand.PlayStation(record)
            "музык" in command -> MusicVoiceCommand.PlayStation(record)
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
