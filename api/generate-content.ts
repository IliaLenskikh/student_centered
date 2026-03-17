import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI } from "openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, responseFormat } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    console.log("Received prompt:", prompt?.slice(0, 50));
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");
      return res.status(500).json({ error: "API keys are not configured on the server." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: responseFormat === "json" ? { type: "json_object" } : { type: "text" },
    });

    console.log("OpenAI response received");
    res.status(200).json({ text: completion.choices[0]?.message?.content || "" });
  } catch (error: any) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: "Failed to generate content", details: error?.message || String(error) });
  }
}
