package ru.alexey.valera

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class ErpSession(val accessToken: String, val refreshToken: String, val userId: String)

class ErpAuthManager(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("valera_erp_auth", Context.MODE_PRIVATE)

    fun session(): ErpSession? {
        val access = prefs.getString("access_token", null) ?: return null
        val refresh = prefs.getString("refresh_token", null) ?: return null
        val userId = prefs.getString("user_id", null) ?: return null
        return ErpSession(access, refresh, userId)
    }

    fun isConnected(): Boolean = session() != null

    fun signIn(email: String, password: String): Result<ErpSession> = runCatching {
        val body = JSONObject().put("email", email.trim()).put("password", password).toString()
        val response = request("/auth/v1/token?grant_type=password", body)
        save(response)
    }

    fun refresh(): Result<ErpSession> = runCatching {
        val current = session() ?: error("ERP не подключена")
        val body = JSONObject().put("refresh_token", current.refreshToken).toString()
        val response = request("/auth/v1/token?grant_type=refresh_token", body)
        save(response)
    }

    fun signOut() { prefs.edit().clear().apply() }

    private fun save(json: JSONObject): ErpSession {
        val access = json.getString("access_token")
        val refresh = json.getString("refresh_token")
        val userId = json.getJSONObject("user").getString("id")
        prefs.edit().putString("access_token", access).putString("refresh_token", refresh).putString("user_id", userId).apply()
        return ErpSession(access, refresh, userId)
    }

    private fun request(path: String, body: String): JSONObject {
        val connection = URL(BASE_URL + path).openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("apikey", PUBLISHABLE_KEY)
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            if (code !in 200..299) {
                val message = runCatching { JSONObject(text).optString("msg").ifBlank { JSONObject(text).optString("error_description") } }.getOrNull()
                error(message?.ifBlank { null } ?: "Ошибка входа ERP ($code)")
            }
            JSONObject(text)
        } finally { connection.disconnect() }
    }

    companion object {
        const val BASE_URL = "https://jjwmaibsqdaofilxuvaw.supabase.co"
        const val PUBLISHABLE_KEY = "sb_publishable_QjURA4bOa7N1REuEQyIXhg_n-5vdqs3"
    }
}
