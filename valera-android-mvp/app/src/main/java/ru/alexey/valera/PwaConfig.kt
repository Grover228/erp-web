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
    val speakOnWake: Boolean
)

object PwaConfig {

    private const val CONFIG_URL =
        "https://raw.githubusercontent.com/Grover228/erp-web/main/public/valera-shell-config.json"

    private const val KEY_ASSISTANT_URL = "assistant_url"
    private const val KEY_OPEN_PWA = "open_pwa_on_wake"
    private const val KEY_SPEAK = "speak_on_wake"

    fun cached(context: Context): ShellConfig {
        val prefs = context.getSharedPreferences(WakeWordService.PREFS, Context.MODE_PRIVATE)
        val url = prefs.getString(KEY_ASSISTANT_URL, null)
            ?.trim()
            ?.takeIf { it.startsWith("https://") }

        return ShellConfig(
            assistantUrl = url,
            openPwaOnWake = prefs.getBoolean(KEY_OPEN_PWA, true),
            speakOnWake = prefs.getBoolean(KEY_SPEAK, true)
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
        context.getSharedPreferences(WakeWordService.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_ASSISTANT_URL, config.assistantUrl ?: "")
            .putBoolean(KEY_OPEN_PWA, config.openPwaOnWake)
            .putBoolean(KEY_SPEAK, config.speakOnWake)
            .apply()
    }

    private fun fetchRemote(): ShellConfig? {
        var connection: HttpURLConnection? = null

        return try {
            connection = (URL(CONFIG_URL).openConnection() as HttpURLConnection).apply {
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

            ShellConfig(
                assistantUrl = assistantUrl,
                openPwaOnWake = json.optBoolean("open_pwa_on_wake", true),
                speakOnWake = json.optBoolean("speak_on_wake", true)
            )
        } catch (_: Throwable) {
            null
        } finally {
            connection?.disconnect()
        }
    }
}
