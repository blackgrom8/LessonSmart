import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

const LAST_RESULT = "./latest.json";

app.get("/", (req, res) => {
  res.send("✅ ScreenApp Webhook is running");
});

app.post("/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Webhook received:", JSON.stringify(data, null, 2));

  let content = {};
  try {
    const summaryBlock = data.file?.systemPromptResponses?.CHAPTERS?.responseText;
    if (summaryBlock) {
      const summaryJson = JSON.parse(summaryBlock);
      content.summary = summaryJson;
      console.log("🧠 Summary found.");
    } else if (data.file?.transcriptUrl) {
      console.log("🗒️ Downloading transcript...");
      const resp = await fetch(data.file.transcriptUrl);
      const transcript = await resp.json();
      content.transcript = transcript.text || "(no text)";
      console.log("🗣️ Transcript saved.");
    } else {
      content.error = "No summary or transcript found.";
      console.log("⚠️ No summary or transcript in payload.");
    }

    // сохраняем последний результат
    fs.writeFileSync(LAST_RESULT, JSON.stringify(content, null, 2));
    res.status(200).send({ success: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

// 🔍 Просмотр последнего результата
app.get("/latest", (req, res) => {
  if (fs.existsSync(LAST_RESULT)) {
    res.sendFile(LAST_RESULT, { root: "." });
  } else {
    res.status(404).send({ error: "No data yet." });
  }
});

app.listen(PORT, () => console.log(`🚀 Webhook server running on port ${PORT}`));
