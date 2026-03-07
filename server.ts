import express from "express";
import { createServer as createViteServer } from "vite";
import { OpenAI, toFile } from "openai";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
      if (!process.env.OPENAI_API_KEY) {
        // Fallback for development environment without OpenAI key
        console.warn("OPENAI_API_KEY is missing. Using mock transcription.");
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        let prompt = `Проанализируй ответ студента: "(Аудио не распознано, так как не настроен ключ OpenAI. Представь, что студент ответил 'Я не знаю' или дал очень короткий ответ)". 
                      Задание было: "${taskContext}".`;
                      
        if (questions && Array.isArray(questions) && questions.length > 0) {
            prompt += `\nВ аудио задавались следующие вопросы:\n${questions.map((q: string, i: number) => `${i+1}. ${q}`).join('\n')}\nОцени, насколько полно и правильно студент ответил на эти вопросы.`;
        }
        
        prompt += `\nДай конструктивные советы по улучшению речи, укажи на ошибки.`;
        
        const streamResponse = await ai.models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");

        for await (const chunk of streamResponse) {
          res.write(chunk.text);
        }
        res.end();
        return;
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // 1. Download audio from Supabase
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) throw new Error("Failed to download audio");
      const audioBuffer = await audioResponse.arrayBuffer();

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
