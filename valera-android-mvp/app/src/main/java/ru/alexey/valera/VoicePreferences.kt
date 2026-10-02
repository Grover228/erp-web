package ru.alexey.valera

import android.content.Context

object VoicePreferences {

    private const val PREFS = "valera-voice"
    private const val KEY_CONFIGURED = "configured"
    private const val KEY_ENGINE_PACKAGE = "engine_package"
    private const val KEY_VOICE_NAME = "voice_name"

    fun isConfigured(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_CONFIGURED, false)

    fun enginePackage(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_ENGINE_PACKAGE, null)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    fun voiceName(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_VOICE_NAME, null)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    fun save(
        context: Context,
        enginePackage: String?,
        voiceName: String?
    ) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_CONFIGURED, true)
            .putString(KEY_ENGINE_PACKAGE, enginePackage.orEmpty())
            .putString(KEY_VOICE_NAME, voiceName.orEmpty())
            .apply()
    }
}
