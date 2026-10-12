import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("OZON_CLIENT_ID");
    const apiKey = Deno.env.get("OZON_API_KEY");

    if (!clientId || !apiKey) {
      throw new Error("Не настроены OZON_CLIENT_ID / OZON_API_KEY.");
    }

    const body = await req.json().catch(() => ({}));
    const supplyId = Number(body?.supplyId || 0);
    const boxes = Array.isArray(body?.boxes) ? body.boxes : [];

    if (!supplyId) throw new Error("Не указан supplyId.");
    if (!boxes.length) throw new Error("Не переданы коробки.");
    if (boxes.length > 30) throw new Error("Ozon разрешает не больше 30 коробок.");

    const cargoes = boxes.map((box: any, index: number) => {
      const quantity = Math.max(0, Number(box?.quantity || 0));
      const item = box?.item || {};
      const barcode = String(item?.barcode || "");
      const offerId = String(item?.offer_id || "");
      const quant = Math.max(1, Number(item?.quant || 1));

      if (!quantity) throw new Error(`В коробке ${index + 1} должно быть больше 0 штук.`);
      if (!barcode && !offerId) {
        throw new Error(`Для коробки ${index + 1} не удалось определить товар.`);
      }

      return {
        key: `box-${String(index + 1).padStart(3, "0")}`,
        value: {
          type: "BOX",
          items: [
            {
              barcode,
              offer_id: offerId,
              quant,
              quantity,
            },
          ],
        },
      };
    });

    const response = await fetch("https://api-seller.ozon.ru/v1/cargoes/create", {
      method: "POST",
      headers: {
        "Client-Id": clientId,
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        supply_id: supplyId,
        delete_current_version: true,
        cargoes,
      }),
    });

    const text = await response.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error?.message ||
        data?.error ||
        `Ozon вернул HTTP ${response.status}`;
      return json({ error: String(message), data }, response.status);
    }

    const reasons = Array.isArray(data?.errors?.error_reasons)
      ? data.errors.error_reasons.filter((reason: string) => reason && reason !== "ERROR_REASON_UNSPECIFIED")
      : [];

    if (reasons.length) {
      return json({ error: reasons.join(", "), data }, 400);
    }

    return json({ data });
  } catch (cause) {
    return json(
      { error: cause instanceof Error ? cause.message : "Не удалось передать грузоместа в Ozon" },
      400,
    );
  }
});
