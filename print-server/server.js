const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const iconv = require("iconv-lite");

const app = express();
const PORT = 3001;
const PRINTER_NAME = "Xprinter XP-365B";
const PRINTER_CODE = "xprinter-main";
const PRINT_QUEUE_URL =
  "https://jjwmaibsqdaofilxuvaw.supabase.co/functions/v1/printer-queue";
const PRINT_POLL_INTERVAL_MS = Number(
  process.env.PRINT_POLL_INTERVAL_MS || 1000
);
const PRINTER_AGENT_TOKEN = process.env.PRINTER_AGENT_TOKEN || "";

let queueWorkerBusy = false;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    mode: "TSPL RAW PRINT SERVER CP1251",
    printer: PRINTER_NAME,
    queueWorker: PRINTER_AGENT_TOKEN ? "enabled" : "disabled",
  });
});

function safeText(value, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  return String(value).replace(/"/g, "'").trim() || fallback;
}

function buildTspl(data) {
  const batchNumber = safeText(data.batchNumber, "PK-TEST");
  const productName = safeText(data.productName, "Шапка бини");
  const article = safeText(data.article, "bini-black-52");
  const quantity = Number(data.quantity || 10);

  void productName;

  return `
SIZE 58 mm,40 mm
GAP 2 mm,0 mm
DENSITY 8
SPEED 4
DIRECTION 1
CODEPAGE 1251
CLS

QRCODE 20,25,L,10,A,0,"${batchNumber}"

TEXT 260,25,"3",0,1,1,"${batchNumber}"
TEXT 260,70,"2",0,1,1,"${article}"
TEXT 260,110,"2",0,1,1,"${quantity} pcs"

PRINT 1
`;
}


function escapeTsplText(value) {
  return safeText(value, "")
    .replace(/~/g, "~~")
    .replace(/"/g, "'");
}

function encodeDataMatrixValue(value) {
  const raw = String(value || "");
  let encoded = "~1";

  for (const char of raw) {
    const code = char.charCodeAt(0);

    if (char === "~") {
      encoded += "~~";
    } else if (char === '"') {
      encoded += "~d034";
    } else if (code < 32 || code === 127) {
      encoded += `~d${String(code).padStart(3, "0")}`;
    } else {
      encoded += char;
    }
  }

  return encoded;
}

function splitHumanCode(value) {
  const code = String(value || "").replace(/^\]d2/, "");
  if (!/^01\d{14}21/.test(code)) throw new Error("Invalid GS1 01/21 marking code");
  const serial = code.slice(18).split("\x1d")[0];
  if (!serial || serial.length > 20) throw new Error("Invalid CHZ serial for label");
  return ["(01)" + code.slice(2, 16), "(21)" + serial];
}

/** 6 care symbols for cotton knitwear; all coordinates in 203-dpi TSPL dots.
 * Symbols occupy x=218..449, y=270..310, safely below the barcode.
 */
function buildCareSymbolsTspl() {
  return [
    // Gentle wash 30 C
    "DIAGONAL 221,277,224,300,2", "DIAGONAL 250,277,247,300,2",
    "BAR 221,276,29,2", "BAR 224,299,23,2", "BAR 226,307,19,2",
    'TEXT 225,284,"1",0,1,1,"30"',
    // Do not bleach: crossed triangle
    "DIAGONAL 258,302,274,273,2", "DIAGONAL 274,273,290,302,2",
    "BAR 258,302,32,2", "DIAGONAL 259,275,289,306,2", "DIAGONAL 289,275,259,306,2",
    // No tumble drying: crossed circle in square
    "BOX 295,274,324,303,2", "CIRCLE 299,278,21,2",
    "DIAGONAL 296,275,323,302,2", "DIAGONAL 323,275,296,302,2",
    // Iron, one dot (low heat)
    "DIAGONAL 337,281,363,281,2", "DIAGONAL 363,281,367,301,2",
    "BAR 335,301,32,2", "CIRCLE 348,289,5,2",
    // Dry flat
    "BOX 374,274,403,303,2", "BAR 379,287,19,2",
    // Do not wring: crossed twisted loop
    "CIRCLE 414,279,24,2", "DIAGONAL 413,275,444,306,2",
    "DIAGONAL 444,275,413,306,2",
  ].join("\n");
}

function buildProductBarcode(data) {
  const barcode = String(data.barcode || "").trim();

  if (/^\d{13}$/.test(barcode)) {
    return [
      `BARCODE 215,201,"EAN13",38,0,0,2,2,"${barcode}"`,
      `TEXT 255,245,"1",0,1,1,"${barcode}"`,
    ].join("\n");
  }

  if (barcode) {
    return [
      `BARCODE 215,201,"128",38,0,0,1,2,"${escapeTsplText(barcode)}"`,
      `TEXT 235,245,"1",0,1,1,"${escapeTsplText(barcode)}"`,
    ].join("\n");
  }

  return `TEXT 230,245,"1",0,1,1,"barcode not set"`;
}

function buildChzLabelTspl(data) {
  const brand = escapeTsplText(data.brand || "СТРИТСТРИМ");
  const productName = escapeTsplText(data.productName || "Изделие");
  const color = escapeTsplText(data.color || "-");
  const size = escapeTsplText(data.size || "-");
  const composition = escapeTsplText(data.composition || "-");
  const [codeLine1, codeLine2] = splitHumanCode(data.code);
  const datamatrix = encodeDataMatrixValue(data.code);
  const barcodeCommands = buildProductBarcode(data);
  const careCommands = buildCareSymbolsTspl();

  return `
SIZE 58 mm,40 mm
GAP 2 mm,0 mm
DENSITY 8
SPEED 3
DIRECTION 1
CODEPAGE 1251
CLS

DMATRIX 20,22,170,170,C126,x4,r0,"${datamatrix}"

BAR 202,12,2,188

TEXT 218,16,"3",0,1,1,"${brand}"
TEXT 218,49,"2",0,1,1,"${productName}"
TEXT 218,76,"1",0,1,1,"Цвет: ${color}"
TEXT 218,96,"1",0,1,1,"Размер: ${size}"
TEXT 218,116,"1",0,1,1,"Состав: ${composition}"

TEXT 20,205,"1",0,1,1,"${escapeTsplText(codeLine1)}"
TEXT 20,220,"1",0,1,1,"${escapeTsplText(codeLine2)}"

${barcodeCommands}
${careCommands}

PRINT 1
`;
}

function buildChzLabelsTspl(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error("No Chestny Znak labels in print job");
  }

  return labels.map((label) => buildChzLabelTspl(label || {})).join("\n");
}

function writeToPrinter(tspl) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "label.txt");
    const encoded = iconv.encode(tspl, "win1251");

    fs.writeFileSync(filePath, encoded);

    const rawPrintScript = path.join(__dirname, "raw-print.ps1");

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        rawPrintScript,
        "-PrinterName",
        PRINTER_NAME,
        "-FilePath",
        filePath,
      ],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const details = (stderr || stdout || error.message).trim();
          reject(new Error(details || error.message));
          return;
        }

        resolve();
      }
    );
  });
}

function sendToPrinter(tspl, res, successMessage) {
  writeToPrinter(tspl)
    .then(() => {
      res.json({
        ok: true,
        message: successMessage,
      });
    })
    .catch((error) => {
      console.log(error);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    });
}

async function queueRequest(action, extra = {}) {
  if (!PRINTER_AGENT_TOKEN) {
    throw new Error(
      "PRINTER_AGENT_TOKEN is not configured. Queue printing is disabled."
    );
  }

  const response = await fetch(PRINT_QUEUE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-printer-token": PRINTER_AGENT_TOKEN,
    },
    body: JSON.stringify({
      action,
      ...extra,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.ok === false) {
    throw new Error(
      result.error || `Printer queue returned HTTP ${response.status}`
    );
  }

  return result;
}

async function processQueueOnce() {
  if (!PRINTER_AGENT_TOKEN || queueWorkerBusy) return;

  queueWorkerBusy = true;

  try {
    const result = await queueRequest("claim");
    const job = result.job;

    if (!job) return;

    try {
      const payload = job.payload || {};
      const tspl =
        job.job_type === "chz_labels"
          ? buildChzLabelsTspl(payload.labels || [])
          : buildTspl(payload);
      await writeToPrinter(tspl);
      await queueRequest("complete", { jobId: job.id });

      console.log(
        `Queue print completed: ${job.id} (${job.payload?.batchNumber || job.job_type})`
      );
    } catch (printError) {
      console.error("Queue print failed:", printError);

      try {
        await queueRequest("fail", {
          jobId: job.id,
          error:
            printError instanceof Error
              ? printError.message
              : String(printError),
        });
      } catch (reportError) {
        console.error("Could not report print failure:", reportError);
      }
    }
  } catch (error) {
    console.error("Print queue polling error:", error);
  } finally {
    queueWorkerBusy = false;
  }
}

function startQueueWorker() {
  if (!PRINTER_AGENT_TOKEN) {
    console.log(
      "Print queue worker is disabled: set PRINTER_AGENT_TOKEN and restart the server."
    );
    return;
  }

  console.log(
    `Print queue worker started: ${PRINTER_CODE}, poll every ${PRINT_POLL_INTERVAL_MS} ms`
  );

  const tick = async () => {
    await processQueueOnce();
    setTimeout(tick, PRINT_POLL_INTERVAL_MS);
  };

  void tick();
}

app.post("/print-label", async (req, res) => {
  try {
    const tspl = buildTspl(req.body || {});

    sendToPrinter(
      tspl,
      res,
      "Этикетка отправлена на печать"
    );
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post("/print-qr", async (req, res) => {
  try {
    const tspl = buildTspl(req.body || {});

    sendToPrinter(
      tspl,
      res,
      "QR отправлен на печать"
    );
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post("/print-test", async (req, res) => {
  try {
    const tspl = buildTspl({
      batchNumber: "PK-TEST-001",
      productName: "Шапка бини",
      article: "bini-black-52",
      quantity: 15,
    });

    sendToPrinter(
      tspl,
      res,
      "Тестовая этикетка отправлена на печать"
    );
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Print server started: http://localhost:${PORT}`);
  startQueueWorker();
});
