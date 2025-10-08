import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import fs from "fs";
import admin from "firebase-admin"; 
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.get("/share", async (req, res) => {
  try {
    if (!fs.existsSync(LAST_RESULT)) {
      return res.status(404).send({ error: "No data to send yet." });
    }

    const content = JSON.parse(fs.readFileSync(LAST_RESULT));
    const snapshot = await db.collection("students").get();

    if (snapshot.empty) {
      console.log("⚠️ No students found in Firestore.");
      return res.status(404).send({ error: "No students found." });
    }

    for (const doc of snapshot.docs) {
      const { email } = doc.data();
      if (!email) continue;

      console.log("📧 Sending email to:", email);

      try {
        const { data: result, error } = await resend.emails.send({
          from: '"Almavalley Hub" <noreply@smartlesson.online>',
          to: email,
          subject: "Important Update from Alma Valley",
          text: content.transcript || "No content available.",
        });

        if (error) {
          console.error(`❌ Error sending to ${email}:`, error);
        } else {
          console.log(`✅ Email sent to ${email} — ID: ${result.id}`);
        }
      } catch (err) {
        console.error(`❌ Failed to send email to ${email}:`, err.message);
      }

      await sleep(500); // ⏱️ пауза 500 мс между письмами
    }

    res.status(200).send({ success: true, message: "Emails sent successfully via Resend." });
  } catch (err) {
    console.error("❌ Error in /share:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});


app.listen(PORT, () => console.log(`🚀 Webhook server running on port ${PORT}`));


