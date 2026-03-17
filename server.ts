import express from "express";
import { createServer as createViteServer } from "vite";
import { OpenAI, toFile } from "openai";
import { GoogleGenAI } from "@google/genai";
import helmet from "helmet";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for Vite development
    crossOriginEmbedderPolicy: false,
  }));
  
  app.use(cors());

  // Limit JSON payload size to prevent DOS
  app.use(express.json({ limit: '1mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze-speech", async (req, res) => {
    const { audioUrl, taskContext, questions } = req.body;

    if (!audioUrl || !taskContext) {
      return res.status(400).json({ error: "Missing audioUrl or taskContext" });
    }

    try {
      if (!process.env.OPENAI_API_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "API keys are not configured on the server." });
      }

      const parsedUrl = new URL(audioUrl);
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ error: "Invalid audioUrl protocol. Must be https." });
      }
      
      // Basic SSRF protection: prevent localhost or local network IPs
      const hostname = parsedUrl.hostname;
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.endsWith('.local')
      ) {
         return res.status(400).json({ error: "Invalid audioUrl hostname." });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // 1. Download audio from Supabase
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) throw new Error("Failed to download audio");
      
      const contentLength = audioResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 15 * 1024 * 1024) { // 15MB limit
         return res.status(400).json({ error: "Audio file too large. Maximum size is 15MB." });
      }
      
      const audioBuffer = await audioResponse.arrayBuffer();
      if (audioBuffer.byteLength > 15 * 1024 * 1024) {
         return res.status(400).json({ error: "Audio file too large." });
      }

      // 2. Transcription via Whisper
      const file = await toFile(audioBuffer, "audio.mp3", { type: "audio/mp3" });
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });

      // 3. Generate feedback via Gemini (Streaming)
      let prompt = `Проанализируй ответ студента: "${transcription.text}". 
                      Задание было: "${taskContext}".`;
                      
      if (questions && Array.isArray(questions) && questions.length > 0) {
          prompt += `\nВ аудио задавались следующие вопросы:\n${questions.map((q, i) => `${i+1}. ${q}`).join('\n')}\nОцени, насколько полно и правильно студент ответил на эти вопросы.`;
      }
      
      prompt += `\nДай конструктивные советы по улучшению речи, укажи на ошибки.`;
      
      const streamResponse = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      // 4. Setup streaming response
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of streamResponse) {
        res.write(chunk.text);
      }
      
      res.end();
    } catch (error) {
      console.error("Error processing speech:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
