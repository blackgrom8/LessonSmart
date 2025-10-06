import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

const LAST_RESULT = "./latest.json";

// Флаг, который будет контролировать, доступен ли текст
let isReadyToFetchText = false;

app.get("/", (req, res) => {
  res.send("✅ ScreenApp Webhook is running");
});

app.post("/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Webhook received:", JSON.stringify(data, null, 2));

  let content = {};
  try {
    // Проверяем, есть ли ссылка на транскрипт
    if (data.file?.transcriptUrl) {
      console.log("🗒️ Downloading transcript...");
      const resp = await fetch(data.file.transcriptUrl);
      const transcript = await resp.json();
      content.transcript = transcript.text || "(no text)";
      console.log("🗣️ Transcript saved.");
    } else {
      content.error = "No transcript found.";
      console.log("⚠️ No transcript in payload.");
    }

    // сохраняем последний результат
    fs.writeFileSync(LAST_RESULT, JSON.stringify(content, null, 2));

    // Устанавливаем флаг в true, чтобы текст был доступен для запроса
    isReadyToFetchText = true;

    res.status(200).send({ success: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

// 🔍 Просмотр последнего результата
app.get("/latest", (req, res) => {
  if (isReadyToFetchText) {
    if (fs.existsSync(LAST_RESULT)) {
      res.sendFile(LAST_RESULT, { root: "." });
    } else {
      res.status(404).send({ error: "No data yet." });
    }
    // После успешного получения данных, сбрасываем флаг
    isReadyToFetchText = false;
  } else {
    res.status(403).send({ error: "Data is not ready yet." });
  }
});

app.listen(PORT, () => console.log(`🚀 Webhook server running on port ${PORT}`));
