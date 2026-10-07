package ru.alexey.valera

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ValeraAppLogger(context: Context) {
    private val appContext = context.applicationContext
    private val auth = ErpAuthManager(appContext)

    fun log(
        eventType: String,
        status: String,
        recognizedText: String? = null,
        action: String? = null,
        errorCode: String? = null,
        errorMessage: String? = null,
        details: JSONObject = JSONObject()
    ) {
        val session = auth.session() ?: return
        Thread {
            runCatching {
                val body = JSONObject()
                    .put("app_version", appVersion())
                    .put("event_type", eventType)
                    .put("recognized_text", recognizedText ?: JSONObject.NULL)
                    .put("action", action ?: JSONObject.NULL)
                    .put("status", status)
                    .put("error_code", errorCode ?: JSONObject.NULL)
                    .put("error_message", errorMessage ?: JSONObject.NULL)
                    .put("details", details)

                val connection = URL(ErpAuthManager.BASE_URL + "/rest/v1/valera_app_logs").openConnection() as HttpURLConnection
                try {
                    connection.requestMethod = "POST"
                    connection.connectTimeout = 5000
                    connection.readTimeout = 5000
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.setRequestProperty("apikey", ErpAuthManager.PUBLISHABLE_KEY)
                    connection.setRequestProperty("Authorization", "Bearer " + session.accessToken)
                    connection.setRequestProperty("Prefer", "return=minimal")
                    connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body.toString()) }
                    val code = connection.responseCode
                    if (code !in 200..299) {
                        connection.errorStream?.close()
                    } else {
                        connection.inputStream?.close()
                    }
                } finally {
                    connection.disconnect()
                }
            }
        }.start()
    }

    private fun appVersion(): String = runCatching {
        val info = appContext.packageManager.getPackageInfo(appContext.packageName, 0)
        info.versionName ?: "unknown"
    }.getOrDefault("unknown")
}
