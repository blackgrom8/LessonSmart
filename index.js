import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";


const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("✅ ScreenApp Webhook is running");
});

app.post("/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Webhook received:", JSON.stringify(data, null, 2));

  // Проверяем наличие блока с Summary
  try {
    const summaryBlock =
      data.file?.systemPromptResponses?.CHAPTERS?.responseText;

    if (summaryBlock) {
      const summaryJson = JSON.parse(summaryBlock);
      console.log("🧠 SUMMARY FOUND!");
      summaryJson.chapters.forEach((ch, i) => {
        console.log(`📘 Chapter ${i + 1}: ${ch.title}`);
        console.log(`🕒 ${ch.start} → ${ch.end}`);
        console.log(`📝 ${ch.notes}\n`);
      });
    } else {
      console.log("ℹ️ No summary found in payload. Trying transcript...");
      if (data.file?.transcriptUrl) {
        console.log("🗒️ Downloading transcript...");
        const resp = await fetch(data.file.transcriptUrl);
        const transcript = await resp.json();
        console.log("🗣️ TRANSCRIPT TEXT:\n", transcript.text || "(no text)");
      }
    }
  } catch (err) {
    console.error("❌ Error parsing summary:", err);
  }

  res.status(200).send({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});
