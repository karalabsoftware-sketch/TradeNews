import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { updateAnalysis } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'

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
  const { id, title, link, summary, piyasa_tipi } = await req.json()
  if (!id || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const isBist = piyasa_tipi === 'bist'

  let content = ''
  if (link) content = await fetchArticleContent(link)
  if (!content && summary) content = summary

  const haberMetni = content ? `Başlık: ${title}\n\nİçerik: ${content}` : `Başlık: ${title}`
  const piyasaBaglami = isBist
    ? `PIYASA_TIPI: BIST30 | PARA_BIRIMI: TL\nAnalizde Türkiye makroekonomik dinamiklerini (TCMB faiz politikası, enflasyon, TL kuru, yerel sektörel çarpanlar) ön planda tut. Etkilenen enstrümanlar için BIST30 hisselerini ve TL bazlı varlıkları önceliklendir.`
    : `PIYASA_TIPI: GLOBAL | PARA_BIRIMI: USD\nAnalizde Fed politikaları, küresel likidite, dolar endeksi ve uluslararası piyasa dinamiklerini ön planda tut.`

  let chat
  try {
    chat = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sen kıdemli bir finansal analist ve ekonomi uzmanısın. Görevin, sana verilen haber metnini objektif, veri odaklı ve manipülasyondan uzak bir şekilde analiz etmektir.\nKesinlikle genel geçer veya yuvarlak cümleler kurma. Yatırım tavsiyesi vermeden, haberin piyasalara, sektörlere ve spesifik finansal enstrümanlara (hisse, emtia, döviz vb.) olası etkilerini rasyonel gerekçelerle açıkla.\nAnaliz raporunu her zaman Türkçe dilinde ve strictly geçerli bir JSON formatında döndür. JSON dışında hiçbir açıklama metni ekleme.`,
        },
        {
          role: 'user',
          content: `${piyasaBaglami}\n\nAnaliz Edilecek Haber:\n"""\n${haberMetni}\n"""\n\nYukarıdaki haberi analiz et ve aşağıdaki JSON şablonuna birebir uyarak yanıt ver:\n\n{\n  "haber_ozeti": "Haberin piyasaları ilgilendiren en kritik 2-3 cümlelik özeti.",\n  "piyasa_etkisi": "Pozitif / Negatif / Nötr",\n  "etki_suresi": "Kısa Vadeli (Günlük/Haftalık) veya Orta-Uzun Vadeli",\n  "etkilenen_sektorler": ["Sektör 1", "Sektör 2"],\n  "etkilenen_enstrumanlar": [\n    {\n      "enstruman_adi": "Somut sembol veya isim (Örn: THYAO, BTC, Altın, Petrol, USDTRY). Genel kategori adı yazma.",\n      "yonu": "Yukarı / Aşağı / Belirsiz",\n      "gerekce": "Bu enstrümanın neden ve nasıl etkileneceğine dair kısa, mantıksal argüman."\n    }\n  ],\n  "risk_puani": 3\n}\n\nNot: risk_puani 1-10 arası tam sayı olmalı (1: Çok Düşük Risk, 10: Çok Yüksek Risk).`,
        },
      ],
      max_tokens: 600,
    })
  } catch (e: unknown) {
    const err = e as { status?: number; error?: unknown; message?: string }
    console.error('Groq error:', JSON.stringify({ status: err.status, error: err.error, message: err.message }))
    return NextResponse.json({ error: 'Groq failed', detail: err.message ?? err.error }, { status: 500 })
  }

  const raw = chat.choices[0].message.content ?? '{}'
  let analysis: string
  try {
    JSON.parse(raw)
    analysis = raw
  } catch {
    analysis = JSON.stringify({ haber_ozeti: raw, piyasa_etkisi: 'Belirsiz', etki_suresi: '-', etkilenen_sektorler: [], etkilenen_enstrumanlar: [], risk_puani: 0 })
  }

  await updateAnalysis(id, analysis)
  return NextResponse.json({ analysis })
}
