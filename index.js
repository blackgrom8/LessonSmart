import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import fs from "fs";
import admin from "firebase-admin"; // Добавляем Firebase

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

const LAST_RESULT = "./latest.json";

// Счетчик вебхуков
let webhookCounter = 0;
let isReadyToFetchText = false;

// Инициализация Firebase
let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
  } catch (err) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON содержит невалидный JSON");
    process.exit(1);
  }
} else {
  console.error("❌ Переменная окружения FIREBASE_SERVICE_ACCOUNT_JSON не установлена");
  process.exit(1);
}

admin.initializeApp({ credential });
const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("✅ ScreenApp Webhook is running");
});

app.post("/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Webhook received:", JSON.stringify(data, null, 2));

  webhookCounter++;

  if (webhookCounter === 1) {
    console.log("⚠️ First webhook received. Waiting for the second one...");
    return res.status(200).send({ success: true, message: "Waiting for second webhook." });
  }

  if (webhookCounter === 2) {
    let content = {};
    try {
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

      fs.writeFileSync(LAST_RESULT, JSON.stringify(content, null, 2));

      isReadyToFetchText = true;
      webhookCounter = 0;

      res.status(200).send({ success: true });
    } catch (err) {
      console.error("❌ Error:", err);
      res.status(500).send({ success: false, error: err.message });
    }
  }
});

app.get("/latest", (req, res) => {
  if (isReadyToFetchText) {
    if (fs.existsSync(LAST_RESULT)) {
      res.sendFile(LAST_RESULT, { root: "." });
      isReadyToFetchText = false;
    } else {
      res.status(404).send({ error: "No data yet." });
    }
  } else {
    res.status(403).send({ error: "Data is not ready yet." });
  }
});

// Новый маршрут /share, который выводит все email из Firestore
app.get("/share", async (req, res) => {
  try {
    // Получаем все документы из коллекции "students"
    const snapshot = await db.collection("students").get();

    if (snapshot.empty) {
      console.log("⚠️ No students found in Firestore.");
      return res.status(404).send({ error: "No students found." });
    }

    // Выводим все email в консоль
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        console.log("📧 Email:", data.email);
      }
    });

    res.status(200).send({ success: true, message: "Emails logged to console." });
  } catch (err) {
    console.error("❌ Error fetching emails:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Webhook server running on port ${PORT}`));
