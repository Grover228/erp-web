package ru.alexey.valera

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ValeraAssistantClient(context: android.content.Context) {
    private val auth = ChatGptAuthManager(context.applicationContext)
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
                val accessToken = auth.accessToken()
                connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10_000
                    readTimeout = 60_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "text/event-stream")
                    setRequestProperty("Authorization", "Bearer " + accessToken)
                }

                val request = JSONObject()
                    .put("model", "gpt-6.1-sol")
                    .put("store", false)
                    .put("stream", true)
                    .put("input", text)
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
                    onError(if (status == 401 || status == 403) "Нужно снова подключить ChatGPT в приложении Валеры." else "ChatGPT временно недоступен (HTTP " + status + ").")
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
            "https://api.openai.com/v1/responses"
    }
}
