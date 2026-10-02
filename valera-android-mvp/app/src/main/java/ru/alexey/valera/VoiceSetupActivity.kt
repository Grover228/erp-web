package ru.alexey.valera

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import java.util.Locale

class VoiceSetupActivity : Activity() {

    private data class EngineOption(
        val label: String,
        val packageName: String?
    ) {
        override fun toString(): String = label
    }

    private lateinit var engineSpinner: Spinner
    private lateinit var voicesContainer: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var saveButton: Button

    private var tts: TextToSpeech? = null
    private var engines: List<EngineOption> = emptyList()
    private var voiceOptions: List<Voice?> = emptyList()
    private var selectedEnginePackage: String? = null
    private var selectedVoiceName: String? = null
    private var selectedEngineLabel: String = "системный"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildUi())
        loadEngines()
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }

    private fun buildUi(): ScrollView {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(7, 10, 19))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(30, 44, 30, 44)
        }

        root.addView(
            TextView(this).apply {
                text = "Голос Валеры"
                textSize = 30f
                setTextColor(Color.WHITE)
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
        )

        root.addView(
            TextView(this).apply {
                text =
                    "Выбери звуковой движок и послушай несколько вариантов голоса. " +
                    "Выбор можно изменить позже в настройках Валеры."
                textSize = 15f
                setTextColor(Color.rgb(170, 184, 210))
                setPadding(0, 10, 0, 24)
            }
        )

        root.addView(sectionTitle("Звуковой движок"))

        engineSpinner = Spinner(this)
        root.addView(
            engineSpinner,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        statusText = TextView(this).apply {
            text = "Ищу установленные голосовые движки…"
            textSize = 14f
            setTextColor(Color.rgb(125, 211, 252))
            setPadding(0, 14, 0, 6)
        }
        root.addView(statusText)

        root.addView(sectionTitle("Варианты голоса"))

        root.addView(
            TextView(this).apply {
                text =
                    "Нажимай варианты и слушай. Android не сообщает надёжно, " +
                    "мужской голос или женский, поэтому выбираем на слух."
                textSize = 13f
                setTextColor(Color.rgb(145, 160, 188))
                setPadding(0, 0, 0, 10)
            }
        )

        voicesContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        root.addView(voicesContainer)

        val systemTtsButton = Button(this).apply {
            text = "СИСТЕМНЫЕ НАСТРОЙКИ ГОЛОСА"
            setOnClickListener {
                try {
                    startActivity(Intent("com.android.settings.TTS_SETTINGS"))
                } catch (_: Throwable) {
                    startActivity(Intent(Settings.ACTION_SETTINGS))
                }
            }
        }
        addWithTopMargin(root, systemTtsButton, 18)

        saveButton = Button(this).apply {
            text = "СОХРАНИТЬ И ПРОДОЛЖИТЬ"
            isEnabled = false
            setOnClickListener {
                VoicePreferences.save(
                    this@VoiceSetupActivity,
                    selectedEnginePackage,
                    selectedVoiceName
                )
                setResult(RESULT_OK)
                finish()
            }
        }
        addWithTopMargin(root, saveButton, 12)

        scroll.addView(root)
        return scroll
    }

    private fun sectionTitle(text: String): TextView =
        TextView(this).apply {
            this.text = text
            textSize = 18f
            setTextColor(Color.WHITE)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 18, 0, 10)
        }

    private fun addWithTopMargin(
        parent: LinearLayout,
        view: android.view.View,
        margin: Int
    ) {
        parent.addView(
            view,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = margin
            }
        )
    }

    @Suppress("DEPRECATION")
    private fun loadEngines() {
        val discovered = packageManager
            .queryIntentServices(
                Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE),
                PackageManager.MATCH_ALL
            )
            .mapNotNull { info ->
                val service = info.serviceInfo ?: return@mapNotNull null
                val label = info.loadLabel(packageManager)
                    ?.toString()
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }
                    ?: service.packageName

                EngineOption(label, service.packageName)
            }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }

        engines = buildList {
            add(EngineOption("Системный движок по умолчанию", null))
            addAll(discovered)
        }

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            engines
        )

        engineSpinner.adapter = adapter

        val savedEngine = VoicePreferences.enginePackage(this)
        val savedIndex = engines.indexOfFirst {
            it.packageName == savedEngine
        }.takeIf { it >= 0 } ?: 0

        engineSpinner.setSelection(savedIndex, false)
        engineSpinner.onItemSelectedListener =
            object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(
                    parent: android.widget.AdapterView<*>?,
                    view: android.view.View?,
                    position: Int,
                    id: Long
                ) {
                    val option = engines.getOrNull(position) ?: return
                    initialiseEngine(option.packageName)
                }

                override fun onNothingSelected(
                    parent: android.widget.AdapterView<*>?
                ) = Unit
            }

        initialiseEngine(engines[savedIndex].packageName)
    }

    private fun initialiseEngine(packageName: String?) {
        tts?.stop()
        tts?.shutdown()
        tts = null

        selectedEnginePackage = packageName
        selectedEngineLabel = engines.firstOrNull { it.packageName == packageName }?.label ?: "системный"
        selectedVoiceName = null
        saveButton.isEnabled = false
        voicesContainer.removeAllViews()
        statusText.text = "Загружаю голоса…"

        val listener = TextToSpeech.OnInitListener { status ->
            if (status != TextToSpeech.SUCCESS) {
                runOnUiThread {
                    statusText.text =
                        "Этот движок не запустился. Выбери другой."
                    saveButton.isEnabled = false
                }
                return@OnInitListener
            }

            runOnUiThread {
                loadVoices()
            }
        }

        tts =
            if (packageName.isNullOrBlank()) {
                TextToSpeech(this, listener)
            } else {
                TextToSpeech(this, listener, packageName)
            }
    }

    private fun loadVoices() {
        val current = tts ?: return

        current.language = Locale("ru", "RU")

        val russianVoices = current.voices
            ?.filter { voice ->
                voice.locale.language.equals("ru", ignoreCase = true)
            }
            ?.distinctBy { it.name }
            ?.sortedWith(
                compareBy<Voice>(
                    { it.isNetworkConnectionRequired },
                    { -it.quality },
                    { it.name }
                )
            )
            .orEmpty()

        voiceOptions =
            if (russianVoices.isNotEmpty()) {
                russianVoices.take(MAX_VOICES)
            } else {
                listOf(null)
            }

        val savedVoice = VoicePreferences.voiceName(this)
        val savedIndex = voiceOptions.indexOfFirst {
            it?.name == savedVoice
        }

        val initialIndex =
            if (savedIndex >= 0) savedIndex else 0

        selectedVoiceName = voiceOptions[initialIndex]?.name
        renderVoiceButtons(initialIndex)

        statusText.text =
            if (russianVoices.isNotEmpty()) {
                val sileroHint = if (selectedEngineLabel.contains("RuVoice", ignoreCase = true)) {
                    " • Silero офлайн"
                } else {
                    ""
                }
                "$selectedEngineLabel$sileroHint • найдено голосов: ${russianVoices.size}. Показываю ${voiceOptions.size}."
            } else {
                "$selectedEngineLabel • отдельные русские голоса не объявлены. Доступен голос движка по умолчанию."
            }

        saveButton.isEnabled = true
    }

    private fun renderVoiceButtons(selectedIndex: Int) {
        voicesContainer.removeAllViews()

        voiceOptions.forEachIndexed { index, voice ->
            val label =
                if (voice == null) {
                    "Вариант ${index + 1} • голос движка по умолчанию"
                } else {
                    val country = voice.locale.country
                        .takeIf { it.isNotBlank() }
                        ?.let { " • $it" }
                        .orEmpty()

                    val mode =
                        if (voice.isNetworkConnectionRequired) {
                            "онлайн"
                        } else {
                            "офлайн"
                        }

                    "${voiceDisplayName(voice)} • ${voice.locale.language}$country • $mode"
                }

            val button = Button(this).apply {
                text =
                    if (index == selectedIndex) {
                        "✓ $label\n▶ Прослушать"
                    } else {
                        "$label\n▶ Прослушать"
                    }

                gravity = Gravity.CENTER_VERTICAL
                setOnClickListener {
                    selectedVoiceName = voice?.name
                    applyVoiceAndPreview(voice)
                    renderVoiceButtons(index)
                }
            }

            addWithTopMargin(voicesContainer, button, 8)
        }
    }

    private fun voiceDisplayName(voice: Voice): String {
        val name = voice.name
        val knownSilero = listOf("aidar", "baya", "kseniya", "xenia", "eugene")
            .firstOrNull { name.contains(it, ignoreCase = true) }
        return if (knownSilero != null) {
            "Silero • $knownSilero"
        } else {
            name
        }
    }

    private fun applyVoiceAndPreview(voice: Voice?) {
        val current = tts ?: return

        if (voice != null) {
            current.voice = voice
        } else {
            current.language = Locale("ru", "RU")
        }

        current.speak(
            "Привет, Алексей. Я Валера. Так будет звучать мой голос.",
            TextToSpeech.QUEUE_FLUSH,
            null,
            "valera-voice-preview"
        )
    }

    companion object {
        private const val MAX_VOICES = 8
    }
}
