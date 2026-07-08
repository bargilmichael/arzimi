import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json());

  // Dynamic AI Translation endpoint
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: "Missing text or targetLanguage" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not defined in the workspace secrets." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a professional construction and contractor task report translator for a quality control application (Bedek). 
Your sole task is to translate the input text precisely into the target language requested by the user's language code ("${targetLanguage}", which represents "he" for Hebrew, "ru" for Russian, "ar" for Arabic).

CRITICAL RULES:
1. Maintain all layout structures, item identifiers, apartment/unit numbers, and emoji structures verbatim.
2. Maintain technical construction terminology accurately in the target language.
3. Do NOT add any conversational intros, explanations, summaries, reviews, or markdown code block wrapper lines (like \`\`\`).
4. Return ONLY the pure translated text itself.

Text to translate:
${text}`;

      // Flexible models in order of preference
      const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
      let translatedText = "";
      let lastError: any = null;
      let success = false;

      for (const model of models) {
        if (success) break;
        // Try up to 3 times per model with exponential backoff on transient errors
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`Attempting translation with model ${model} (attempt ${attempt}/3)...`);
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
            });

            if (response && response.text) {
              translatedText = response.text.trim();
              success = true;
              console.log(`Translation succeeded using model: ${model}`);
              break;
            }
          } catch (error: any) {
            lastError = error;
            console.error(`Attempt ${attempt} with model ${model} failed:`, error.message || error);
            if (attempt < 3) {
              const delay = attempt * 1000; // 1s, 2s backoff
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      }

      if (!success) {
        throw lastError || new Error("All translation models and retry attempts failed.");
      }

      res.json({ translation: translatedText });
    } catch (error: any) {
      console.error("Translation api error:", error);
      res.status(500).json({ error: error.message || "Failed to translate content via Gemini" });
    }
  });

  // SMS Gateway (TextBee integration)
  app.post("/api/send-sms", async (req, res) => {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ error: "Missing phone or message parameter." });
      }

      console.log(`Sending SMS to: ${phone}`);

      // Normalize phone number for Israeli cellular providers
      let targetPhone = phone.trim();
      targetPhone = targetPhone.replace(/[\s\-\(\)]/g, ''); // remove spaces and common separators

      if (targetPhone.startsWith('05')) {
        targetPhone = '+972' + targetPhone.substring(1);
      } else if (targetPhone.startsWith('5')) {
        targetPhone = '+972' + targetPhone;
      } else if (targetPhone.startsWith('972') && !targetPhone.startsWith('+')) {
        targetPhone = '+' + targetPhone;
      } else if (!targetPhone.startsWith('+')) {
        targetPhone = '+' + targetPhone;
      }

      const deviceId = process.env.TEXTBEE_DEVICE_ID || "6a4e3cf09317f40a16b64ea7";
      const apiKey = process.env.TEXTBEE_API_KEY || "f8d4b8e1-d961-4181-8860-525a0dfc203f";

      const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

      console.log(`Requesting TextBee URL: ${url} with phone: ${targetPhone}`);

      const response = await axios.post(
        url,
        {
          recipients: [targetPhone],
          message: message
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey
          }
        }
      );

      console.log(`SMS successfully sent via TextBee to ${targetPhone}:`, response.data);
      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Failed to send SMS:", error.response?.data || error.message || error);
      res.status(500).json({ 
        error: error.response?.data?.message || error.message || "Failed to send SMS via TextBee" 
      });
    }
  });

  // Hot module replacement or dev/prod static rendering fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
