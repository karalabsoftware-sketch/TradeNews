import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { updateAnalysis } from '@/lib/store'

export const dynamic = 'force-dynamic'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const { id, title } = await req.json()
  if (!id || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const chat = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [
      {
        role: 'user',
        content: `Aşağıdaki finansal haberi Türkçe olarak 2-3 cümleyle analiz et. Borsaya olası etkisini belirt.\n\nHaber: ${title}`,
      },
    ],
    max_tokens: 200,
  })

  const analysis = chat.choices[0].message.content ?? ''
  await updateAnalysis(id, analysis)

  return NextResponse.json({ analysis })
}
