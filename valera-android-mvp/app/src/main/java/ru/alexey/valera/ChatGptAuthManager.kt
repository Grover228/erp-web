package ru.alexey.valera

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.interfaces.RSAPublicKey
import java.util.Base64
import java.util.UUID
import com.auth0.jwk.JwkProviderBuilder
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm

class ChatGptAuthManager(private val context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isConnected(): Boolean =
        !prefs.getString(KEY_ACCESS_TOKEN, null).isNullOrBlank() &&
            !prefs.getString(KEY_CLIENT_ID, null).isNullOrBlank()

    fun beginSignIn(onStatus: (String) -> Unit, onDone: (Boolean, String) -> Unit) {
        Thread {
            var server: ServerSocket? = null
            try {
                server = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
                server.soTimeout = 180_000
                val redirectUri = "http://127.0.0.1:${server.localPort}/auth/callback"
                val state = randomUrlSafe(32)
                val nonce = randomUrlSafe(32)
                val verifier = randomUrlSafe(64)
                val challenge = base64Url(
                    MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())
                )
                val hostId = getOrCreateHostId()
                val savedClientId = prefs.getString(KEY_CLIENT_ID, null)
                val clientId = savedClientId ?: DYNAMIC_CLIENT_ID

                val params = linkedMapOf(
                    "client_id" to clientId,
                    "response_type" to "code",
                    "redirect_uri" to redirectUri,
                    "scope" to SCOPES,
                    "resource" to RESOURCE,
                    "state" to state,
                    "nonce" to nonce,
                    "code_challenge_method" to "S256",
                    "code_challenge" to challenge,
                    "ext_agent_host_id" to hostId
                )
                if (savedClientId == null) {
                    params["agent_name_hint"] = "Валера"
                } else {
                    prefs.getString(KEY_ID_TOKEN, null)?.let { params["id_token_hint"] = it }
                }

                val authUrl = AUTHORIZE_URL + "?" + params.entries.joinToString("&") {
                    enc(it.key) + "=" + enc(it.value)
                }
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                onStatus("Заверши вход в ChatGPT в браузере")

                val socket = server.accept()
                val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
                val requestLine = reader.readLine().orEmpty()
                val target = requestLine.split(" ").getOrNull(1).orEmpty()
                val query = target.substringAfter("?", "")
                val callback = parseQuery(query)

                OutputStreamWriter(socket.getOutputStream()).use { writer ->
                    val body = "<html><body><h2>Валера подключён к ChatGPT.</h2><p>Можно закрыть эту страницу и вернуться в приложение.</p></body></html>"
                    writer.write("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${body.toByteArray().size}\r\nConnection: close\r\n\r\n$body")
                    writer.flush()
                }
                socket.close()

                if (callback["state"] != state) throw IllegalStateException("OAuth state не совпал")
                callback["error"]?.let { throw IllegalStateException("Вход отменён: $it") }
                val code = callback["code"] ?: throw IllegalStateException("OpenAI не вернул authorization code")
                val issuedClientId = callback["client_id"] ?: savedClientId
                    ?: throw IllegalStateException("OpenAI не вернул client_id")

                val token = exchangeCode(issuedClientId, code, verifier, redirectUri)
                validateIdToken(token.getString("id_token"), issuedClientId, nonce)
                val scope = token.optString("scope")
                if (!scope.split(" ").contains("chatgpt.tokens.use.direct")) {
                    throw IllegalStateException("Не разрешено использование плана ChatGPT")
                }
                saveTokens(issuedClientId, token)
                onDone(true, "ChatGPT подключён")
            } catch (e: Throwable) {
                onDone(false, friendlyError(e))
            } finally {
                try { server?.close() } catch (_: Throwable) {}
            }
        }.start()
    }

    fun accessToken(): String {
        val token = prefs.getString(KEY_ACCESS_TOKEN, null)
            ?: throw IllegalStateException("ChatGPT не подключён")
        val expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L)
        if (System.currentTimeMillis() < expiresAt - 120_000L) return token
        return refresh()
    }

    private fun exchangeCode(
        clientId: String,
        code: String,
        verifier: String,
        redirectUri: String
    ): JSONObject = postForm(
        mapOf(
            "grant_type" to "authorization_code",
            "client_id" to clientId,
            "code" to code,
            "code_verifier" to verifier,
            "redirect_uri" to redirectUri,
            "resource" to RESOURCE
        )
    )

    @Synchronized
    private fun refresh(): String {
        val clientId = prefs.getString(KEY_CLIENT_ID, null)
            ?: throw IllegalStateException("Нет client_id ChatGPT")
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null)
            ?: throw IllegalStateException("Нужно снова войти в ChatGPT")
        val token = postForm(
            mapOf(
                "grant_type" to "refresh_token",
                "client_id" to clientId,
                "refresh_token" to refreshToken,
                "resource" to RESOURCE
            )
        )
        saveTokens(clientId, token)
        return token.getString("access_token")
    }

    private fun postForm(values: Map<String, String>): JSONObject {
        val connection = URL(TOKEN_URL).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            val body = values.entries.joinToString("&") { enc(it.key) + "=" + enc(it.value) }
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)
                .bufferedReader(Charsets.UTF_8).use { it.readText() }
            if (status !in 200..299) throw IllegalStateException("OAuth HTTP $status")
            return JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }

    private fun validateIdToken(idToken: String, clientId: String, nonce: String) {
        val decoded = JWT.decode(idToken)
        val keyId = decoded.keyId ?: throw IllegalStateException("ID token без kid")
        val jwk = JwkProviderBuilder(URL(JWKS_URL)).build().get(keyId)
        val algorithm = Algorithm.RSA256(jwk.publicKey as RSAPublicKey, null)
        JWT.require(algorithm)
            .withIssuer(ISSUER)
            .withAudience(clientId)
            .withClaim("nonce", nonce)
            .build()
            .verify(idToken)
    }

    private fun saveTokens(clientId: String, token: JSONObject) {
        val expiresIn = token.optLong("expires_in", 3600L)
        val editor = prefs.edit()
            .putString(KEY_CLIENT_ID, clientId)
            .putString(KEY_ACCESS_TOKEN, token.getString("access_token"))
            .putString(KEY_ID_TOKEN, token.optString("id_token"))
            .putString(KEY_SCOPE, token.optString("scope"))
            .putLong(KEY_EXPIRES_AT, System.currentTimeMillis() + expiresIn * 1000L)
        if (token.has("refresh_token")) {
            editor.putString(KEY_REFRESH_TOKEN, token.getString("refresh_token"))
        }
        editor.apply()
    }

    private fun getOrCreateHostId(): String {
        prefs.getString(KEY_HOST_ID, null)?.let { return it }
        val value = "urn:uuid:" + UUID.randomUUID().toString()
        prefs.edit().putString(KEY_HOST_ID, value).apply()
        return value
    }

    private fun parseQuery(query: String): Map<String, String> =
        query.split("&").filter { it.contains("=") }.associate {
            val pair = it.split("=", limit = 2)
            URLDecoder.decode(pair[0], "UTF-8") to URLDecoder.decode(pair[1], "UTF-8")
        }

    private fun friendlyError(e: Throwable): String {
        val message = e.message.orEmpty()
        return when {
            message.contains("SocketTimeout", true) -> "Время входа истекло. Нажми «Продолжить с ChatGPT» ещё раз."
            message.contains("access_denied", true) -> "Доступ к ChatGPT не разрешён."
            else -> message.takeIf { it.isNotBlank() } ?: "Не удалось подключить ChatGPT"
        }
    }

    private fun randomUrlSafe(bytes: Int): String {
        val data = ByteArray(bytes)
        SecureRandom().nextBytes(data)
        return base64Url(data)
    }

    private fun base64Url(data: ByteArray): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(data)

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    companion object {
        private const val PREFS = "valera-chatgpt-auth"
        private const val KEY_HOST_ID = "host_id"
        private const val KEY_CLIENT_ID = "client_id"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_ID_TOKEN = "id_token"
        private const val KEY_SCOPE = "scope"
        private const val KEY_EXPIRES_AT = "expires_at"

        private const val DYNAMIC_CLIENT_ID = "dynamic_agent_client"
        private const val AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize"
        private const val TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token"
        private const val JWKS_URL = "https://auth.openai.com/.well-known/jwks.json"
        private const val ISSUER = "https://auth.openai.com"
        private const val RESOURCE = "https://api.openai.com/v1"
        private const val SCOPES =
            "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
    }
}
