import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = Deno.env.get("VALERA_OPENAI_MODEL") || "gpt-5.6";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY_not_configured" }, 503);

  let body: { text?: unknown; previous_response_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const inputText = typeof body.text === "string" ? body.text.trim() : "";
  if (!inputText) return json({ error: "text_required" }, 400);
  if (inputText.length > 12000) return json({ error: "text_too_long" }, 413);

  const payload: Record<string, unknown> = {
    model: MODEL,
    stream: true,
    input: [{ role: "user", content: [{ type: "input_text", text: inputText }] }],
    instructions:
      "Ты Валера, голосовой помощник Алексея. Отвечай по-русски, естественно и кратко. " +
      "Ответ будет озвучен вслух, поэтому не используй markdown-таблицы и лишнее форматирование.",
  };

  if (typeof body.previous_response_id === "string" && body.previous_response_id.trim()) {
    payload.previous_response_id = body.previous_response_id.trim();
  }

  const upstream = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    return json(
      { error: "openai_error", status: upstream.status, detail: detail.slice(0, 2000) },
      502,
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}
