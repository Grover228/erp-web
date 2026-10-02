package ru.alexey.valera

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ValeraAssistantClient {
    @Volatile private var cancelled = false

    fun cancel() { cancelled = true }

    fun stream(
        text: String,
        previousResponseId: String?,
        onDelta: (String) -> Unit,
        onResponseId: (String) -> Unit,
        onDone: () -> Unit,
        onError: (String) -> Unit
    ) {
        cancelled = false
        Thread {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10_000
                    readTimeout = 60_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "text/event-stream")
                    setRequestProperty("apikey", SUPABASE_ANON_KEY)
                    setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY)
                }

                val request = JSONObject().put("text", text)
                if (!previousResponseId.isNullOrBlank()) {
                    request.put("previous_response_id", previousResponseId)
                }

                connection.outputStream.use {
                    it.write(request.toString().toByteArray(Charsets.UTF_8))
                }

                val status = connection.responseCode
                if (status !in 200..299) {
                    val body = connection.errorStream
                        ?.bufferedReader(Charsets.UTF_8)
                        ?.use { it.readText() }
                        .orEmpty()
                    onError("HTTP " + status + ": " + body.take(500))
                    return@Thread
                }

                BufferedReader(InputStreamReader(connection.inputStream, Charsets.UTF_8)).use { reader ->
                    while (!cancelled) {
                        val line = reader.readLine() ?: break
                        if (!line.startsWith("data:")) continue
                        val payload = line.removePrefix("data:").trim()
                        if (payload.isBlank() || payload == "[DONE]") continue

                        val event = try { JSONObject(payload) } catch (_: Throwable) { continue }
                        when (event.optString("type")) {
                            "response.created", "response.completed" -> {
                                event.optJSONObject("response")
                                    ?.optString("id")
                                    ?.takeIf { it.isNotBlank() }
                                    ?.let(onResponseId)
                            }
                            "response.output_text.delta" -> {
                                event.optString("delta")
                                    .takeIf { it.isNotEmpty() }
                                    ?.let(onDelta)
                            }
                            "error" -> {
                                onError(event.optString("message", "Ошибка OpenAI"))
                                return@Thread
                            }
                        }
                    }
                }
                if (!cancelled) onDone()
            } catch (exception: Throwable) {
                if (!cancelled) onError(exception.message ?: "Ошибка соединения")
            } finally {
                connection?.disconnect()
            }
        }.start()
    }

    companion object {
        private const val ENDPOINT =
            "https://jjwmaibsqdaofilxuvaw.supabase.co/functions/v1/valera-assistant"
        private const val SUPABASE_ANON_KEY =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqd21haWJzcWRhb2ZpbHh1dmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODg4NzMsImV4cCI6MjA5MjM2NDg3M30.43GlOumDk0tE2dRnE1Bsm9HsKkQFWbYCAbiFQ1HpCYI"
    }
}
