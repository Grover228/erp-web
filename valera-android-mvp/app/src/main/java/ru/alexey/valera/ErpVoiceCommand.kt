package ru.alexey.valera

import java.util.Locale

sealed class ErpVoiceCommand {
    data object OpenShift : ErpVoiceCommand()
    data object CloseShift : ErpVoiceCommand()
    data object StartCutting : ErpVoiceCommand()
    data object FinishCutting : ErpVoiceCommand()
    data object Progress : ErpVoiceCommand()
    data object Print : ErpVoiceCommand()
}

object ErpVoiceCommands {
    private val aliases = mapOf(
        "открой смену" to ErpVoiceCommand.OpenShift,
        "открыть смену" to ErpVoiceCommand.OpenShift,
        "закрой смену" to ErpVoiceCommand.CloseShift,
        "закрыть смену" to ErpVoiceCommand.CloseShift,
        "начни раскрой" to ErpVoiceCommand.StartCutting,
        "начать раскрой" to ErpVoiceCommand.StartCutting,
        "запусти раскрой" to ErpVoiceCommand.StartCutting,
        "закончи раскрой" to ErpVoiceCommand.FinishCutting,
        "закончить раскрой" to ErpVoiceCommand.FinishCutting,
        "сколько готово" to ErpVoiceCommand.Progress,
        "сколько уже готово" to ErpVoiceCommand.Progress,
        "сколько сделано" to ErpVoiceCommand.Progress,
        "отправить на печать" to ErpVoiceCommand.Print,
        "отправь на печать" to ErpVoiceCommand.Print
    )

    fun parse(rawText: String): ErpVoiceCommand? {
        var text = normalize(rawText)
        if (text.startsWith("валера ")) text = text.removePrefix("валера ").trim()
        return aliases[text]
    }

    private fun normalize(value: String): String =
        value.lowercase(Locale("ru", "RU"))
            .replace('ё', 'е')
            .replace(Regex("""[^а-я0-9\s]"""), " ")
            .replace(Regex("""\s+"""), " ")
            .trim()
}
