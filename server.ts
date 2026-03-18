console.log("Starting server.ts...");

import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import { OpenAI, toFile } from "openai";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request logging for API
  app.use("/api", (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Limit JSON payload size to prevent DOS
  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze-speech", async (req, res) => {
    const { audioUrl, audioBase64, taskContext, questions } = req.body;

    if (!audioUrl && !audioBase64) {
      return res.status(400).json({ error: "Missing audioUrl or audioBase64" });
    }
    if (!taskContext) {
      return res.status(400).json({ error: "Missing taskContext" });
    }

    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "API keys are not configured on the server." });
      }

      let audioBuffer: ArrayBuffer | Buffer;

      if (audioBase64) {
        audioBuffer = Buffer.from(audioBase64, 'base64');
      } else {
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

        // 1. Download audio from Supabase
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) throw new Error("Failed to download audio");
        
        const contentLength = audioResponse.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 15 * 1024 * 1024) { // 15MB limit
           return res.status(400).json({ error: "Audio file too large. Maximum size is 15MB." });
        }
        
        const arrayBuffer = await audioResponse.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
      }

      if (audioBuffer.byteLength > 15 * 1024 * 1024) {
         return res.status(400).json({ error: "Audio file too large." });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // 2. Transcription via Whisper
      const file = await toFile(audioBuffer, "audio.webm", { type: "audio/webm" });
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });

      // 3. Generate structured feedback via OpenAI
      const prompt = `Проанализируй ответ студента: "${transcription.text}". 
Задание было: "${taskContext}".
${questions && Array.isArray(questions) && questions.length > 0 ? `В аудио задавались следующие вопросы:\n${questions.map((q, i) => `${i+1}. ${q}`).join('\n')}\nОцени, насколько полно и правильно студент ответил на эти вопросы.` : ''}

Верни ответ в формате JSON со следующей структурой:
{
  "mistakes": [
    {
      "text": "точная цитата из текста студента с ошибкой",
      "type": "grammar" | "vocabulary" | "pronunciation" | "content",
      "explanation": "краткое объяснение ошибки",
      "correction": "как сказать правильно"
    }
  ],
  "sentenceCount": <число предложений в тексте>,
  "generalFeedback": "общий комментарий и советы"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const feedback = JSON.parse(completion.choices[0]?.message?.content || "{}");

      res.json({
        transcription: transcription.text,
        feedback
      });
    } catch (error: any) {
      console.error("Error processing speech:", error);
      res.status(500).json({ 
        error: "Failed to process audio", 
        details: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  app.post("/api/generate-content", async (req, res) => {
    const { prompt, responseFormat } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "API keys are not configured on the server." });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: responseFormat === "json" ? { type: "json_object" } : { type: "text" },
      });

      res.json({ text: completion.choices[0]?.message?.content || "" });
    } catch (error: any) {
      console.error("Error generating content:", error);
      res.status(500).json({ 
        error: "Failed to generate content", 
        details: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  // 404 handler for API routes
  app.all("/api/*all", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware initialized");
  } else {
    // In production, serve static files from dist
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // SPA fallback for production
    app.get("*all", (req, res) => {
      res.sendFile("index.html", { root: distPath });
    });
  }

  // Global error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled error:", err);
    
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    
    res.status(500).json({ 
      error: "Internal server error", 
      details: err?.message || String(err),
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  });

  console.log("Attempting to listen on port", PORT);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});

console.log("server.ts execution finished");
