import { OpenAI } from 'openai';
import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';

// Инициализация клиентов
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { audioUrl, taskContext } = req.body;

  if (!audioUrl || !taskContext) {
    return res.status(400).json({ error: 'Missing audioUrl or taskContext' });
  }

  try {
    // 1. Скачиваем аудио из Supabase
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error('Failed to download audio');
    const audioBuffer = await audioResponse.arrayBuffer();

    // 2. Транскрибация через Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.mp3', { type: 'audio/mp3' }),
      model: 'whisper-1',
    });

    // 3. Генерация фидбека через Gemini (Streaming)
    const prompt = `Проанализируй ответ студента: "${transcription.text}". 
                    Задание было: "${taskContext}". 
                    Дай конструктивные советы по улучшению речи, укажи на ошибки.`;
    
    const streamResponse = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // 4. Настройка стриминга в ответ
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of streamResponse) {
      res.write(chunk.text);
    }
    
    res.end();
  } catch (error) {
    console.error('Error processing speech:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
}
