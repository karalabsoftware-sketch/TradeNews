import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { updateAnalysis } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    // Meta description ve article paragraflarını çek
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,500})["']/i)?.[1] ?? ''
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,500})["']/i)?.[1] ?? ''
    // Paragraf metinlerini çek
    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]{30,800}?)<\/p>/g)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 50)
      .slice(0, 5)
      .join(' ')
    return (ogDesc || metaDesc || paragraphs).slice(0, 1000)
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  const { id, title, link, summary } = await req.json()
  if (!id || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Önce URL'den içerik çekmeyi dene, olmazsa RSS summary kullan
  let content = ''
  if (link) {
    content = await fetchArticleContent(link)
  }
  if (!content && summary) content = summary

  const prompt = content
    ? `Başlık: ${title}\n\nİçerik: ${content}`
    : `Başlık: ${title}`

  let chat
  try {
    chat = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `Aşağıdaki finansal haberi Türkçe olarak analiz et. Şunları belirt:\n1. Haberin özeti (1 cümle)\n2. Hangi piyasa/varlık etkilenir (hisse, emtia, döviz, kripto vb. spesifik isim ver)\n3. Olası etki yönü (olumlu/olumsuz) ve sebebi\n\n${prompt}`,
        },
      ],
      max_tokens: 300,
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
