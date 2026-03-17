import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI, toFile } from "openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    let audioBuffer: Buffer;

    if (audioBase64) {
      audioBuffer = Buffer.from(audioBase64, 'base64');
    } else {
      const parsedUrl = new URL(audioUrl);
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ error: "Invalid audioUrl protocol. Must be https." });
      }
      
      // Download audio
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) throw new Error("Failed to download audio");
      
      const arrayBuffer = await audioResponse.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    }

    if (audioBuffer.byteLength > 15 * 1024 * 1024) {
       return res.status(400).json({ error: "Audio file too large. Maximum size is 15MB." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1. Transcription via Whisper
    const file = await toFile(audioBuffer, "audio.webm", { type: "audio/webm" });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    // 2. Generate structured feedback
    const prompt = `Проанализируй ответ студента: "${transcription.text}". 
Задание было: "${taskContext}".
${questions && Array.isArray(questions) && questions.length > 0 ? `В аудио задавались следующие вопросы:\n${questions.map((q: string, i: number) => `${i+1}. ${q}`).join('\n')}\nОцени, насколько полно и правильно студент ответил на эти вопросы.` : ''}

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

    res.status(200).json({
      transcription: transcription.text,
      feedback
    });
  } catch (error: any) {
    console.error("Error processing speech:", error);
    res.status(500).json({ error: "Failed to process audio", details: error?.message || String(error) });
  }
}
