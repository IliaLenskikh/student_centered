import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI, toFile } from "openai";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';

// Set ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

async function removeSilence(inputBuffer: Buffer): Promise<Buffer> {
  const tempId = Date.now() + '-' + Math.random().toString(36).substring(7);
  const inputPath = join(tmpdir(), `${tempId}_input.webm`);
  const outputPath = join(tmpdir(), `${tempId}_output.webm`);
  
  await writeFile(inputPath, inputBuffer);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // Remove silence at the beginning and in the middle
      // start_periods=1: remove silence at start
      // stop_periods=-1: remove silence in the middle/end
      // stop_duration=1: 1 second of silence triggers removal
      // threshold=-45dB: anything below -45dB is considered silence
      .audioFilters('silenceremove=start_periods=1:start_duration=0.1:start_threshold=-45dB:stop_periods=-1:stop_duration=1:stop_threshold=-45dB')
      .output(outputPath)
      .on('end', async () => {
        try {
          const outputBuffer = await readFile(outputPath);
          // Cleanup
          await unlink(inputPath).catch(console.error);
          await unlink(outputPath).catch(console.error);
          resolve(outputBuffer);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', async (err) => {
        // Cleanup
        await unlink(inputPath).catch(console.error);
        await unlink(outputPath).catch(console.error);
        console.error('FFmpeg error:', err);
        // If ffmpeg fails, fallback to original buffer
        resolve(inputBuffer);
      })
      .run();
  });
}

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
    console.log("Analyzing speech. audioUrl:", audioUrl ? "present" : "absent", "audioBase64:", audioBase64 ? "present" : "absent");
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");
      return res.status(500).json({ error: "API keys are not configured on the server." });
    }

    let audioBuffer: Buffer;

    if (audioBase64) {
      console.log("Using audioBase64");
      audioBuffer = Buffer.from(audioBase64, 'base64');
    } else {
      console.log("Downloading from audioUrl:", audioUrl);
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
      
      // Download audio
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
      
      const arrayBuffer = await audioResponse.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    }

    console.log("Audio buffer size:", audioBuffer.byteLength);
    if (audioBuffer.byteLength > 15 * 1024 * 1024) {
       return res.status(400).json({ error: "Audio file too large. Maximum size is 15MB." });
    }

    // Process audio to remove silence and reduce Whisper API costs
    console.log("Processing audio to remove silence...");
    try {
      audioBuffer = await removeSilence(audioBuffer);
      console.log("Processed audio buffer size:", audioBuffer.byteLength);
    } catch (err) {
      console.error("Failed to remove silence, proceeding with original audio:", err);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1. Transcription via Whisper
    console.log("Starting transcription...");
    const file = await toFile(audioBuffer, "audio.webm", { type: "audio/webm" });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    console.log("Transcription complete:", transcription.text.slice(0, 50));

    // 2. Generate structured feedback
    console.log("Generating feedback...");
    
    const isInterview = questions && Array.isArray(questions) && questions.length > 0;
    
    let prompt = `Проанализируй ответ студента: "${transcription.text}".\nЗадание было: "${taskContext}".\n`;
    
    if (isInterview) {
      prompt += `
В задании есть текст вопросов:
${questions.map((q: string, i: number) => `${i+1}. ${q}`).join('\n')}

Нужно проверить, насколько правильно ученик ответил на эти вопросы с точки зрения грамматики, лексики и логики. 
По сути, идеальный ответ ученика — это 6 правильных предложений (полные, развернутые ответы на заданные вопросы).
`;
    } else {
      prompt += `Оцени ответ студента с точки зрения грамматики, лексики и содержания.\n`;
    }

    prompt += `
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
  "generalFeedback": "общий комментарий и советы (если это интервью, обязательно укажи, на все ли вопросы даны ответы и насколько они полные/логичные)"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    console.log("Feedback generated");
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
