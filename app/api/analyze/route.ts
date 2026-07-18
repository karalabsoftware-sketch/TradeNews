import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { updateAnalysis } from '@/lib/store'

export const dynamic = 'force-dynamic'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const { id, title, summary } = await req.json()
  if (!id || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const content = summary
    ? `Başlık: ${title}\n\nİçerik özeti: ${summary}`
    : `Başlık: ${title}`

  let chat
  try {
    chat = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `Aşağıdaki finansal haberi Türkçe olarak 2-3 cümleyle analiz et. Borsaya ve piyasalara olası etkisini belirt.\n\n${content}`,
        },
      ],
      max_tokens: 200,
    })
  } catch (e: unknown) {
    const err = e as { status?: number; error?: unknown; message?: string }
    console.error('Groq error:', JSON.stringify({ status: err.status, error: err.error, message: err.message }))
    return NextResponse.json({ error: 'Groq failed', detail: err.error }, { status: 500 })
  }

  const analysis = chat.choices[0].message.content ?? ''
  await updateAnalysis(id, analysis)

  return NextResponse.json({ analysis })
}
