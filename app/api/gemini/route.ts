import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured' },
      { status: 500 },
    );
  }

  let body: { prompt: string; healthContext?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, healthContext } = body;
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const systemParts: string[] = [];
  systemParts.push(
    'You are a friendly health insights assistant for the Voyage health dashboard. ' +
    'Give concise, helpful answers. Do not provide medical diagnoses or treatment advice.',
  );

  if (healthContext) {
    systemParts.push(
      "Here is the user's health data for today:\n" +
      JSON.stringify(healthContext, null, 2) +
      '\nUse this data to answer their questions when relevant.',
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { role: 'user', parts: [{ text: systemParts.join('\n\n') + '\n\nUser question: ' + prompt }] },
      ],
    });

    const text = response.text ?? '';
    return NextResponse.json({ reply: text });
  } catch (err: unknown) {
    console.error('Gemini API error:', err);
    const message = err instanceof Error ? err.message : 'Gemini request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
