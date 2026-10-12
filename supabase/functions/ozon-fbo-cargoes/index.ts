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
      const items = Array.isArray(box?.items) ? box.items : [];
      if (!items.length) throw new Error(`Коробка ${index + 1} пустая.`);

      const normalizedItems = items
        .map((item: any) => ({
          barcode: String(item?.barcode || ""),
          offer_id: String(item?.offer_id || ""),
          quant: Math.max(1, Number(item?.quant || 1)),
          quantity: Math.max(0, Number(item?.quantity || 0)),
        }))
        .filter((item: any) => item.quantity > 0);

      if (!normalizedItems.length) throw new Error(`Коробка ${index + 1} пустая.`);
      for (const item of normalizedItems) {
        if (!item.barcode && !item.offer_id) {
          throw new Error(`Для одного из товаров в коробке ${index + 1} не удалось определить идентификатор.`);
        }
      }

      return {
        key: `box-${String(index + 1).padStart(3, "0")}`,
        value: {
          type: "BOX",
          items: normalizedItems,
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
