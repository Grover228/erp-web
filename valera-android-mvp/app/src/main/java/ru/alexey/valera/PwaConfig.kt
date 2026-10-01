package ru.alexey.valera

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class ShellConfig(
    val assistantUrl: String?,
    val openPwaOnWake: Boolean,
    val speakOnWake: Boolean,
    val wakeTarget: String,
    val chatGptPackage: String,
    val chatGptVoiceActivity: String,
    val chatGptVoiceFallbackUrl: String
)

object PwaConfig {

    const val TARGET_PWA = "pwa"
    const val TARGET_SYSTEM_ASSISTANT = "system_assistant"
    const val TARGET_CHATGPT_DIRECT = "chatgpt_direct"

    private const val CONFIG_URL =
        "https://raw.githubusercontent.com/Grover228/erp-web/main/public/valera-shell-config.json"

    private const val KEY_ASSISTANT_URL = "assistant_url"
    private const val KEY_OPEN_PWA = "open_pwa_on_wake"
    private const val KEY_SPEAK = "speak_on_wake"
    private const val KEY_WAKE_TARGET = "wake_target"
    private const val KEY_CHATGPT_PACKAGE = "chatgpt_package"
    private const val KEY_CHATGPT_VOICE_ACTIVITY = "chatgpt_voice_activity"
    private const val KEY_CHATGPT_VOICE_FALLBACK_URL = "chatgpt_voice_fallback_url"

    private const val DEFAULT_CHATGPT_PACKAGE = "com.openai.chatgpt"
    private const val DEFAULT_CHATGPT_VOICE_ACTIVITY =
        "com.openai.voice.assistant.AssistantActivity"
    private const val DEFAULT_CHATGPT_VOICE_FALLBACK_URL =
        "https://chat.com/?mode=voice"

    fun cached(context: Context): ShellConfig {
        val prefs = context.getSharedPreferences(
            WakeWordService.PREFS,
            Context.MODE_PRIVATE
        )

        val url = prefs.getString(KEY_ASSISTANT_URL, null)
            ?.trim()
            ?.takeIf { it.startsWith("https://") }

        val wakeTarget = prefs.getString(
            KEY_WAKE_TARGET,
            TARGET_CHATGPT_DIRECT
        )?.takeIf {
            it == TARGET_PWA ||
                it == TARGET_SYSTEM_ASSISTANT ||
                it == TARGET_CHATGPT_DIRECT
        } ?: TARGET_CHATGPT_DIRECT

        return ShellConfig(
            assistantUrl = url,
            openPwaOnWake = prefs.getBoolean(KEY_OPEN_PWA, false),
            speakOnWake = prefs.getBoolean(KEY_SPEAK, false),
            wakeTarget = wakeTarget,
            chatGptPackage = prefs.getString(
                KEY_CHATGPT_PACKAGE,
                DEFAULT_CHATGPT_PACKAGE
            )?.takeIf { it.isNotBlank() } ?: DEFAULT_CHATGPT_PACKAGE,
            chatGptVoiceActivity = prefs.getString(
                KEY_CHATGPT_VOICE_ACTIVITY,
                DEFAULT_CHATGPT_VOICE_ACTIVITY
            )?.takeIf { it.isNotBlank() } ?: DEFAULT_CHATGPT_VOICE_ACTIVITY,
            chatGptVoiceFallbackUrl = prefs.getString(
                KEY_CHATGPT_VOICE_FALLBACK_URL,
                DEFAULT_CHATGPT_VOICE_FALLBACK_URL
            )?.takeIf { it.startsWith("https://") }
                ?: DEFAULT_CHATGPT_VOICE_FALLBACK_URL
        )
    }

    fun refresh(
        context: Context,
        callback: ((ShellConfig) -> Unit)? = null
    ) {
        val appContext = context.applicationContext

        Thread {
            val remote = fetchRemote()
            val resolved = if (remote != null) {
                save(appContext, remote)
                remote
            } else {
                cached(appContext)
            }

            if (callback != null) {
                Handler(Looper.getMainLooper()).post {
                    callback(resolved)
                }
            }
        }.start()
    }

    private fun save(context: Context, config: ShellConfig) {
        context.getSharedPreferences(
            WakeWordService.PREFS,
            Context.MODE_PRIVATE
        )
            .edit()
            .putString(KEY_ASSISTANT_URL, config.assistantUrl ?: "")
            .putBoolean(KEY_OPEN_PWA, config.openPwaOnWake)
            .putBoolean(KEY_SPEAK, config.speakOnWake)
            .putString(KEY_WAKE_TARGET, config.wakeTarget)
            .putString(KEY_CHATGPT_PACKAGE, config.chatGptPackage)
            .putString(
                KEY_CHATGPT_VOICE_ACTIVITY,
                config.chatGptVoiceActivity
            )
            .putString(
                KEY_CHATGPT_VOICE_FALLBACK_URL,
                config.chatGptVoiceFallbackUrl
            )
            .apply()
    }

    private fun fetchRemote(): ShellConfig? {
        var connection: HttpURLConnection? = null

        return try {
            connection = (
                URL(CONFIG_URL).openConnection() as HttpURLConnection
            ).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
                useCaches = false
                setRequestProperty("Accept", "application/json")
            }

            if (connection.responseCode !in 200..299) {
                return null
            }

            val body = connection.inputStream
                .bufferedReader(Charsets.UTF_8)
                .use { it.readText() }

            val json = JSONObject(body)

            val assistantUrl = json.optString("assistant_url")
                .trim()
                .takeIf { it.startsWith("https://") }

            val wakeTarget = json.optString(
                "wake_target",
                TARGET_CHATGPT_DIRECT
            ).takeIf {
                it == TARGET_PWA ||
                    it == TARGET_SYSTEM_ASSISTANT ||
                    it == TARGET_CHATGPT_DIRECT
            } ?: TARGET_CHATGPT_DIRECT

            ShellConfig(
                assistantUrl = assistantUrl,
                openPwaOnWake = json.optBoolean(
                    "open_pwa_on_wake",
                    false
                ),
                speakOnWake = json.optBoolean(
                    "speak_on_wake",
                    false
                ),
                wakeTarget = wakeTarget,
                chatGptPackage = json.optString(
                    "chatgpt_package",
                    DEFAULT_CHATGPT_PACKAGE
                ).takeIf { it.isNotBlank() } ?: DEFAULT_CHATGPT_PACKAGE,
                chatGptVoiceActivity = json.optString(
                    "chatgpt_voice_activity",
                    DEFAULT_CHATGPT_VOICE_ACTIVITY
                ).takeIf { it.isNotBlank() }
                    ?: DEFAULT_CHATGPT_VOICE_ACTIVITY,
                chatGptVoiceFallbackUrl = json.optString(
                    "chatgpt_voice_fallback_url",
                    DEFAULT_CHATGPT_VOICE_FALLBACK_URL
                ).takeIf { it.startsWith("https://") }
                    ?: DEFAULT_CHATGPT_VOICE_FALLBACK_URL
            )
        } catch (_: Throwable) {
            null
        } finally {
            connection?.disconnect()
        }
    }
}
