const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const iconv = require("iconv-lite");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    mode: "TSPL RAW PRINT SERVER CP1251",
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

function sendToPrinter(tspl, res, successMessage) {
  const filePath = path.join(__dirname, "label.txt");

  const encoded = iconv.encode(tspl, "win1251");

  fs.writeFileSync(filePath, encoded);

  exec(`COPY /B "${filePath}" "\\\\localhost\\Xprinter"`, (error) => {
    if (error) {
      console.log(error);

      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    res.json({
      ok: true,
      message: successMessage,
    });
  });
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
});