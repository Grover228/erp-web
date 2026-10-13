const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRUE_API_BASES = {
  v3: "https://markirovka.crpt.ru/api/v3/true-api",
  v4: "https://markirovka.crpt.ru/api/v4/true-api",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  let payload: any = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const upstreamMessage =
      payload?.error_message ||
      payload?.description ||
      payload?.message ||
      payload?.error ||
      payload?.raw ||
      "";
    const suffix = upstreamMessage ? `: ${String(upstreamMessage).slice(0, 500)}` : "";
    throw new Error(`Честный ЗНАК вернул HTTP ${response.status}${suffix}`);
  }

  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "challenge") {
      const errors: string[] = [];

      for (const apiVersion of ["v3", "v4"] as const) {
        try {
          const response = await fetch(`${TRUE_API_BASES[apiVersion]}/auth/key`, {
            method: "GET",
            headers: { Accept: "application/json" },
          });

          const payload = await parseJsonResponse(response);
          const uuid = String(payload?.uuid || "");
          const data = String(payload?.data || "");

          if (!uuid || !data) {
            throw new Error("Честный ЗНАК не вернул uuid/data для подписи.");
          }

          return json({ uuid, data, apiVersion });
        } catch (cause) {
          errors.push(`${apiVersion}: ${cause instanceof Error ? cause.message : "ошибка запроса"}`);
        }
      }

      throw new Error(`Не удалось получить данные для подписи. ${errors.join(" | ")}`);
    }

    if (action === "signin") {
      const omsConnection = String(body?.omsConnection || "").trim();
      const uuid = String(body?.uuid || "").trim();
      const signature = String(body?.signature || "").replace(/\s+/g, "");
      const inn = String(body?.inn || "").trim();
      const requestedVersion = String(body?.apiVersion || "v3");
      const apiVersion: keyof typeof TRUE_API_BASES = requestedVersion === "v4" ? "v4" : "v3";
      const trueApiBase = TRUE_API_BASES[apiVersion];

      if (!omsConnection) throw new Error("Не указан omsConnection.");
      if (!uuid) throw new Error("Не указан UUID авторизации.");
      if (!signature) throw new Error("Не передана подпись УКЭП.");

      const requestBody: Record<string, string> = {
        uuid,
        data: signature,
      };
      if (inn) requestBody.inn = inn;

      const response = await fetch(
        `${trueApiBase}/auth/simpleSignIn/${encodeURIComponent(omsConnection)}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      const payload = await parseJsonResponse(response);
      const token = String(payload?.token || "");

      if (!token) {
        const message =
          payload?.error_message ||
          payload?.description ||
          payload?.code ||
          "Честный ЗНАК не вернул clientToken.";
        throw new Error(String(message));
      }

      return json({
        token,
        apiVersion,
        expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      });
    }

    return json({ error: "Неизвестное действие." }, 400);
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Не удалось выполнить авторизацию Честного ЗНАКа.";
    console.error("chestny-znak-auth:", message);
    return json({ error: message }, 400);
  }
});
