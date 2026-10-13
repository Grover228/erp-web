const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRUE_API_BASE = "https://markirovka.crpt.ru/api/v4/true-api";

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
    const message =
      payload?.error_message ||
      payload?.description ||
      payload?.message ||
      payload?.error ||
      `Честный ЗНАК вернул HTTP ${response.status}`;
    throw new Error(String(message));
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
      const response = await fetch(`${TRUE_API_BASE}/auth/key`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const payload = await parseJsonResponse(response);
      const uuid = String(payload?.uuid || "");
      const data = String(payload?.data || "");

      if (!uuid || !data) {
        throw new Error("Честный ЗНАК не вернул uuid/data для подписи.");
      }

      return json({ uuid, data });
    }

    if (action === "signin") {
      const omsConnection = String(body?.omsConnection || "").trim();
      const uuid = String(body?.uuid || "").trim();
      const signature = String(body?.signature || "").replace(/\s+/g, "");
      const inn = String(body?.inn || "").trim();

      if (!omsConnection) throw new Error("Не указан omsConnection.");
      if (!uuid) throw new Error("Не указан UUID авторизации.");
      if (!signature) throw new Error("Не передана подпись УКЭП.");

      const requestBody: Record<string, string> = {
        uuid,
        data: signature,
      };
      if (inn) requestBody.inn = inn;

      const response = await fetch(
        `${TRUE_API_BASE}/auth/simpleSignIn/${encodeURIComponent(omsConnection)}`,
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
        expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      });
    }

    return json({ error: "Неизвестное действие." }, 400);
  } catch (cause) {
    return json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Не удалось выполнить авторизацию Честного ЗНАКа.",
      },
      400,
    );
  }
});
