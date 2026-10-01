const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
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

function writeToPrinter(tspl) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "label.txt");
    const encoded = iconv.encode(tspl, "win1251");

    fs.writeFileSync(filePath, encoded);

    exec(`COPY /B "${filePath}" "\\\\localhost\\Xprinter"`, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
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
      const tspl = buildTspl(job.payload || {});
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
