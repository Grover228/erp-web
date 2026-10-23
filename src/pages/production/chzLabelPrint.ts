// Единый макет этикетки ЧЗ 58×40: заказ и производственная пачка.
export type LabelProductData = { brand: string; productName: string; color: string; size: string; composition: string; barcode: string };
function renderBarcodeDataUrl(value: string) {
    const bwipjs = window.bwipjs;
    if (!bwipjs?.toCanvas) throw new Error("Модуль штрихкодов ещё не загрузился.");

    const canvas = document.createElement("canvas");
    const clean = String(value || "").trim();
    if (!clean) return "";

    try {
      bwipjs.toCanvas(canvas, {
        bcid: /^\d{13}$/.test(clean) ? "ean13" : "code128",
        text: clean,
        scale: 3,
        height: 9,
        includetext: false,
        padding: 0,
        backgroundcolor: "FFFFFF",
      });
    } catch {
      bwipjs.toCanvas(canvas, {
        bcid: "code128",
        text: clean,
        scale: 3,
        height: 9,
        includetext: false,
        padding: 0,
        backgroundcolor: "FFFFFF",
      });
    }

    return canvas.toDataURL("image/png");
  }

function renderDataMatrixDataUrl(code: string) {
    const bwipjs = window.bwipjs;
    if (!bwipjs?.toCanvas) throw new Error("Модуль DataMatrix ещё не загрузился.");

    const canvas = document.createElement("canvas");
    const gs1Text =
      "^FNC1" +
      String(code || "")
        .replace(/\^/g, "^^")
        .replace(/\x1d/g, "^FNC1");

    bwipjs.toCanvas(canvas, {
      bcid: "datamatrix",
      text: gs1Text,
      parsefnc: true,
      scale: 5,
      padding: 2,
      backgroundcolor: "FFFFFF",
    });

    return canvas.toDataURL("image/png");
  }


function humanChzLines(value: string): [string, string] {
    const code = String(value || "").replace(/^\]d2/, "");
    if (!/^01\d{14}21/.test(code)) throw new Error("Код ЧЗ не содержит GS1 (01)/(21); печать остановлена.");
    const serial = code.slice(18).split("\x1d")[0];
    if (!serial || serial.length > 20) throw new Error("Серийный номер кода ЧЗ не помещается на этикетку.");
    return ["(01)" + code.slice(2, 16), "(21)" + serial];
  }

const careHtml = [
    '<svg viewBox="0 0 32 32" aria-label="Бережная стирка 30 градусов"><path d="M3 7 Q7 4 11 7 T19 7 T29 7 L26 27 H6 Z M7 30 H25" fill="none" stroke="#000" stroke-width="2"/><text x="16" y="21" font-size="12" text-anchor="middle" font-weight="700" font-family="Arial">30</text></svg>',
    '<svg viewBox="0 0 32 32" aria-label="Не отбеливать"><path d="M16 4 L29 27 H3 Z M3 3 L29 29 M29 3 L3 29" fill="none" stroke="#000" stroke-width="2"/></svg>',
    '<svg viewBox="0 0 32 32" aria-label="Не сушить в барабане"><rect x="4" y="4" width="24" height="24" fill="none" stroke="#000" stroke-width="2"/><circle cx="16" cy="16" r="9" fill="none" stroke="#000" stroke-width="2"/><path d="M4 4 L28 28 M28 4 L4 28" stroke="#000" stroke-width="2"/></svg>',
  ].join("");


export function printUnifiedChzLabels(receivedSuzCodes: string[], labelProductData: LabelProductData | null, orderNumber: string): number {
    if (!receivedSuzCodes.length) throw new Error("Нет кодов ЧЗ для печати.");
    if (!labelProductData) throw new Error("Данные товара для этикетки ещё не загружены.");

    // Never silently print a different layout when a product card is incomplete.
    const requiredFields: Array<[string, string]> = [
      ["Бренд", labelProductData.brand],
      ["Название", labelProductData.productName],
      ["Цвет", labelProductData.color],
      ["Размер", labelProductData.size],
      ["Состав", labelProductData.composition],
      ["Штрихкод", labelProductData.barcode],
    ];
    const missing = requiredFields.filter(([, value]) => !String(value || "").trim()).map(([name]) => name);
    if (missing.length) {
      throw new Error(`Печать остановлена: в карточке товара не заполнено: ${missing.join(", ")}.`);
    }

    try {
      const barcodeImage = labelProductData.barcode
        ? renderBarcodeDataUrl(labelProductData.barcode)
        : "";

      const labels = receivedSuzCodes.map((code, index) => ({
        index: index + 1,
        dm: renderDataMatrixDataUrl(code),
        human: humanChzLines(code),
      }));

      const popup = window.open("", "_blank", "width=900,height=700");
      if (!popup) throw new Error("Браузер заблокировал окно печати.");

      const esc = (value: string) =>
        String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      popup.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Этикетки 58×40 — ${esc(orderNumber)}</title>
<style>
  @page { size: 58mm 40mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #000; background: #fff; }
  .label {
    width: 55.5mm;
    height: 40mm;
    margin-left: 2.5mm;
    page-break-after: always;
    overflow: hidden;
    display: grid;
    grid-template-columns: 20mm 1fr;
    gap: 1.6mm;
    padding: 1.4mm;
  }
  .label:last-child { page-break-after: auto; }
  .left {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .8mm;
    min-width: 0;
  }
  .dm { width: 18.5mm; height: 18.5mm; object-fit: contain; image-rendering: pixelated; }
  .dm-code { font: 5pt/1.15 monospace; text-align: center; width: 20mm; white-space: nowrap; letter-spacing: -.1pt; }
  .right {
    min-width: 0;
    border-left: .25mm solid #222;
    padding-left: 1.6mm;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .brand { font-size: 10pt; font-weight: 900; line-height: 1; margin-bottom: 1mm; }
  .name { font-size: 7.7pt; font-weight: 900; line-height: 1.05; margin-bottom: .8mm; text-transform: none; }
  .row { font-size: 6.6pt; line-height: 1.14; margin-bottom: .35mm; }
  .row b { font-weight: 900; }
  .composition { font-size: 6.1pt; line-height: 1.08; margin-top: .2mm; }
  .barcode-wrap { margin-top: auto; padding-top: .7mm; text-align: center; }
  .barcode { width: 100%; height: 8mm; object-fit: fill; display: block; }
  .barcode-number { font: 6.2pt monospace; line-height: 1; letter-spacing: .15mm; margin-top: .25mm; }
  .care { display: flex; gap: 1.7mm; justify-content: center; align-items: center; margin-top: 1mm; height: 4.4mm; }
  .care svg { width: 4.3mm; height: 4.3mm; flex: 0 0 4.3mm; display: block; }
  .no-barcode { font-size: 6pt; border: .25mm solid #999; padding: 1mm; text-align: center; }
  @media screen {
    body { background: #e5e7eb; padding: 8mm; }
    .label { margin: 0 auto 8mm; background: #fff; box-shadow: 0 2mm 5mm rgba(0,0,0,.18); }
  }
</style>
</head>
<body>
${labels.map((label) => `
  <section class="label">
    <div class="left">
      <img class="dm" src="${label.dm}" alt="DataMatrix">
      <div class="dm-code"><div>${esc(label.human[0])}</div><div>${esc(label.human[1])}</div></div>
    </div>
    <div class="right">
      <div class="brand">${esc(labelProductData.brand)}</div>
      <div class="name">${esc(labelProductData.productName)}</div>
      ${labelProductData.color ? `<div class="row">Цвет: <b>${esc(labelProductData.color)}</b></div>` : ""}
      ${labelProductData.size ? `<div class="row">Размер: <b>${esc(labelProductData.size)}</b></div>` : ""}
      ${labelProductData.composition ? `<div class="composition">Состав: <b>${esc(labelProductData.composition)}</b></div>` : ""}
      <div class="barcode-wrap">
        ${barcodeImage
          ? `<img class="barcode" src="${barcodeImage}" alt="Штрихкод"><div class="barcode-number">${esc(labelProductData.barcode)}</div>`
          : `<div class="no-barcode">Штрихкод товара не заполнен</div>`}
      </div>
      <div class="care">${careHtml}</div>
    </div>
  </section>`).join("")}
<script>
  window.addEventListener("load", () => {
    setTimeout(() => window.print(), 250);
  });
</script>
</body>
</html>`);
      popup.document.close();
      return labels.length;
    } catch (cause) { throw cause; }
  }

