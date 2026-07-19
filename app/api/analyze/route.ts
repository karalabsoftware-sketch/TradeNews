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
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,500})["']/i)?.[1] ?? ''
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,500})["']/i)?.[1] ?? ''
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

  let content = ''
  if (link) content = await fetchArticleContent(link)
  if (!content && summary) content = summary

  const haberMetni = content ? `Başlık: ${title}\n\nİçerik: ${content}` : `Başlık: ${title}`

  let chat
  try {
    chat = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sen kıdemli bir finansal analist ve ekonomi uzmanısın. Görevin, sana verilen haber metnini objektif, veri odaklı ve manipülasyondan uzak bir şekilde analiz etmektir.
Kesinlikle genel geçer veya yuvarlak cümleler kurma. Yatırım tavsiyesi vermeden, haberin piyasalara, sektörlere ve spesifik finansal enstrümanlara (hisse, emtia, döviz vb.) olası etkilerini rasyonel gerekçelerle açıkla.
Analiz raporunu her zaman Türkçe dilinde ve strictly geçerli bir JSON formatında döndür. JSON dışında hiçbir açıklama metni ekleme.`,
        },
        {
          role: 'user',
          content: `Analiz Edilecek Haber:
"""
${haberMetni}
"""

Yukarıdaki haberi analiz et ve aşağıdaki JSON şablonuna birebir uyarak yanıt ver:

{
  "haber_ozeti": "Haberin piyasaları ilgilendiren en kritik 2-3 cümlelik özeti.",
  "piyasa_etkisi": "Pozitif / Negatif / Nötr",
  "etki_suresi": "Kısa Vadeli (Günlük/Haftalık) veya Orta-Uzun Vadeli",
  "etkilenen_sektorler": ["Sektör 1", "Sektör 2"],
  "etkilenen_enstrumanlar": [
    {
      "enstruman_adi": "Somut sembol veya isim (Örn: THYAO, BTC, Altın, Petrol, USDTRY). Genel kategori adı yazma (Örn: 'Kripto Para Endeksleri', 'Hisse Senetleri', 'Emtia Piyasası' gibi ifadeler YASAK).",
      "yonu": "Yukarı / Aşağı / Belirsiz",
      "gerekce": "Bu enstrümanın neden ve nasıl etkileneceğine dair kısa, mantıksal argüman."
    }
  ],
  "risk_puani": 3
}

Not: risk_puani 1-10 arası tam sayı olmalı (1: Çok Düşük Risk, 10: Çok Yüksek Risk).`,
        },
      ],
      max_tokens: 600,
    })
  } catch (e: unknown) {
    const err = e as { status?: number; error?: unknown; message?: string }
    console.error('Groq error:', JSON.stringify({ status: err.status, error: err.error, message: err.message }))
    return NextResponse.json({ error: 'Groq failed', detail: err.error }, { status: 500 })
  }

  const raw = chat.choices[0].message.content ?? '{}'
  let analysis: string
  try {
    JSON.parse(raw) // geçerli JSON mi kontrol et
    analysis = raw
  } catch {
    analysis = JSON.stringify({ haber_ozeti: raw, piyasa_etkisi: 'Belirsiz', etki_suresi: '-', etkilenen_sektorler: [], etkilenen_enstrumanlar: [], risk_puani: 0 })
  }

  await updateAnalysis(id, analysis)
  return NextResponse.json({ analysis })
}
