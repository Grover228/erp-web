package ru.alexey.valera

sealed class LightVoiceCommand {
    data class Power(val on: Boolean) : LightVoiceCommand()
    data class Color(
        val label: String,
        val red: Int,
        val green: Int,
        val blue: Int
    ) : LightVoiceCommand()
    data class Brightness(val percent: Int) : LightVoiceCommand()
    data class TimerOff(val minutes: Int) : LightVoiceCommand()
    data class PowerForMinutes(val minutes: Int) : LightVoiceCommand()
    data object CancelTimer : LightVoiceCommand()
}

object LightVoiceCommands {

    private data class NamedColor(
        val label: String,
        val aliases: List<String>,
        val red: Int,
        val green: Int,
        val blue: Int
    )

    private val colors = listOf(
        NamedColor("красный", listOf("красный", "красным"), 255, 0, 0),
        NamedColor("зелёный", listOf("зеленый", "зеленым"), 0, 255, 0),
        NamedColor("синий", listOf("синий", "синим"), 0, 0, 255),
        NamedColor("белый", listOf("белый", "белым"), 255, 255, 255),
        NamedColor("фиолетовый", listOf("фиолетовый", "фиолетовым"), 160, 0, 255),
        NamedColor("жёлтый", listOf("желтый", "желтым"), 255, 220, 0),
        NamedColor("оранжевый", listOf("оранжевый", "оранжевым"), 255, 90, 0),
        NamedColor("розовый", listOf("розовый", "розовым"), 255, 40, 140),
        NamedColor("голубой", listOf("голубой", "голубым"), 0, 180, 255),
        NamedColor("бирюзовый", listOf("бирюзовый", "бирюзовым"), 0, 255, 190),
        NamedColor("тёплый белый", listOf("теплый белый"), 255, 150, 55)
    )

    private val units = mapOf(
        "ноль" to 0,
        "один" to 1,
        "одна" to 1,
        "одну" to 1,
        "два" to 2,
        "две" to 2,
        "три" to 3,
        "четыре" to 4,
        "пять" to 5,
        "шесть" to 6,
        "семь" to 7,
        "восемь" to 8,
        "девять" to 9
    )

    private val teens = mapOf(
        "десять" to 10,
        "одиннадцать" to 11,
        "двенадцать" to 12,
        "тринадцать" to 13,
        "четырнадцать" to 14,
        "пятнадцать" to 15,
        "шестнадцать" to 16,
        "семнадцать" to 17,
        "восемнадцать" to 18,
        "девятнадцать" to 19
    )

    private val tens = mapOf(
        "двадцать" to 20,
        "тридцать" to 30,
        "сорок" to 40,
        "пятьдесят" to 50,
        "шестьдесят" to 60,
        "семьдесят" to 70,
        "восемьдесят" to 80,
        "девяносто" to 90
    )

    fun parse(rawText: String): LightVoiceCommand? {
        val text = normalize(rawText)
        if (!text.contains("валера")) return null

        val afterWake = text.substringAfter("валера").trim()
        if (afterWake.isBlank()) return null

        if (
            ("отмени" in afterWake || "сбрось" in afterWake || "убери" in afterWake) &&
            "таймер" in afterWake
        ) {
            return LightVoiceCommand.CancelTimer
        }

        val durationMinutes = extractDurationMinutes(afterWake)
        if (durationMinutes != null) {
            if (
                "включ" in afterWake &&
                (" на " in " $afterWake " || "таймер" in afterWake)
            ) {
                return LightVoiceCommand.PowerForMinutes(durationMinutes)
            }

            if (
                "таймер" in afterWake ||
                "через" in afterWake ||
                "выключ" in afterWake
            ) {
                return LightVoiceCommand.TimerOff(durationMinutes)
            }
        }

        if ("ярк" in afterWake) {
            val value = extractNumber(afterWake)
            if (value != null) {
                return LightVoiceCommand.Brightness(value.coerceIn(0, 100))
            }
        }

        for (color in colors) {
            if (color.aliases.any { alias -> afterWake.contains(alias) }) {
                return LightVoiceCommand.Color(
                    label = color.label,
                    red = color.red,
                    green = color.green,
                    blue = color.blue
                )
            }
        }

        if (
            ("выключ" in afterWake || "погаси" in afterWake) &&
            ("свет" in afterWake || "лент" in afterWake)
        ) {
            return LightVoiceCommand.Power(false)
        }

        if (
            ("включ" in afterWake || "зажги" in afterWake) &&
            ("свет" in afterWake || "лент" in afterWake)
        ) {
            return LightVoiceCommand.Power(true)
        }

        return null
    }

    fun grammarJson(): String {
        val phrases = linkedSetOf<String>()

        phrases += "валера"

        phrases += listOf(
            "валера включи свет",
            "валера выключи свет",
            "валера включи ленту",
            "валера выключи ленту",
            "валера зажги свет",
            "валера погаси свет",
            "валера отмени таймер",
            "валера сбрось таймер света"
        )

        colors.forEach { color ->
            color.aliases.forEach { alias ->
                phrases += "валера $alias"
                phrases += "валера сделай свет $alias"
                phrases += "валера свет $alias"
                phrases += "валера поставь $alias"
                phrases += "валера сделай $alias"
            }
        }

        for (value in 0..100 step 5) {
            val words = numberToWords(value)
            phrases += "валера яркость $words процентов"
            phrases += "валера сделай яркость $words процентов"
            phrases += "валера свет $words процентов"
        }

        for (minutes in 1..120) {
            val words = numberToWordsForMinutes(minutes)
            val minuteWord = minuteForm(minutes)

            phrases += "валера выключи свет через $words $minuteWord"
            phrases += "валера таймер света на $words $minuteWord"
            phrases += "валера поставь таймер на $words $minuteWord"
            phrases += "валера включи свет на $words $minuteWord"
        }

        for (hours in 1..12) {
            val words = numberToWords(hours)
            val hourWord = hourForm(hours)

            phrases += "валера выключи свет через $words $hourWord"
            phrases += "валера таймер света на $words $hourWord"
            phrases += "валера включи свет на $words $hourWord"
        }

        return phrases.joinToString(
            prefix = "[\"",
            separator = "\", \"",
            postfix = "\", \"[unk]\"]"
        )
    }

    fun describe(command: LightVoiceCommand): String =
        when (command) {
            is LightVoiceCommand.Power ->
                if (command.on) "Включаю свет" else "Выключаю свет"
            is LightVoiceCommand.Color ->
                "Ставлю ${command.label} свет"
            is LightVoiceCommand.Brightness ->
                "Яркость ${command.percent} процентов"
            is LightVoiceCommand.TimerOff ->
                "Выключу свет через ${command.minutes} минут"
            is LightVoiceCommand.PowerForMinutes ->
                "Включаю свет на ${command.minutes} минут"
            LightVoiceCommand.CancelTimer ->
                "Таймер света отменён"
        }

    private fun extractDurationMinutes(text: String): Int? {
        val number = extractNumber(text) ?: return null

        return when {
            text.contains("час") ->
                (number * 60).coerceIn(1, 12 * 60)
            text.contains("минут") ->
                number.coerceIn(1, 24 * 60)
            else -> null
        }
    }

    private fun extractNumber(text: String): Int? {
        Regex("""\b\d{1,4}\b""")
            .find(text)
            ?.value
            ?.toIntOrNull()
            ?.let { return it }

        val tokens = text
            .split(" ")
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        var total = 0
        var found = false

        for (token in tokens) {
            when {
                token == "сто" -> {
                    total += 100
                    found = true
                }
                tens.containsKey(token) -> {
                    total += tens.getValue(token)
                    found = true
                }
                teens.containsKey(token) -> {
                    total += teens.getValue(token)
                    found = true
                }
                units.containsKey(token) -> {
                    total += units.getValue(token)
                    found = true
                }
            }
        }

        return if (found) total else null
    }

    private fun normalize(value: String): String =
        value
            .lowercase()
            .replace('ё', 'е')
            .replace(Regex("""[^а-я0-9\s]"""), " ")
            .replace(Regex("""\s+"""), " ")
            .trim()

    private fun numberToWords(value: Int): String {
        if (value == 0) return "ноль"
        if (value == 100) return "сто"

        if (value in 10..19) {
            return teens.entries.first { it.value == value }.key
        }

        if (value > 100) {
            val remainder = value - 100
            return if (remainder == 0) {
                "сто"
            } else {
                "сто " + numberToWords(remainder)
            }
        }

        val tensPart = value / 10 * 10
        val unitsPart = value % 10
        val parts = mutableListOf<String>()

        if (tensPart >= 20) {
            parts += tens.entries.first { it.value == tensPart }.key
        }

        if (unitsPart > 0) {
            val preferredUnit = when (unitsPart) {
                1 -> "один"
                2 -> "два"
                else -> units.entries.first { it.value == unitsPart }.key
            }
            parts += preferredUnit
        }

        return parts.joinToString(" ")
    }

    private fun numberToWordsForMinutes(value: Int): String {
        val base = numberToWords(value)

        return when {
            value % 100 in 11..14 -> base
            value % 10 == 1 ->
                base.substringBeforeLast("один", base) +
                    if (base.endsWith("один")) "одну" else ""
            value % 10 == 2 ->
                base.substringBeforeLast("два", base) +
                    if (base.endsWith("два")) "две" else ""
            else -> base
        }.trim()
    }

    private fun minuteForm(value: Int): String {
        val mod100 = value % 100
        val mod10 = value % 10

        return when {
            mod100 in 11..14 -> "минут"
            mod10 == 1 -> "минуту"
            mod10 in 2..4 -> "минуты"
            else -> "минут"
        }
    }

    private fun hourForm(value: Int): String =
        when {
            value % 100 in 11..14 -> "часов"
            value % 10 == 1 -> "час"
            value % 10 in 2..4 -> "часа"
            else -> "часов"
        }
}
