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
    ? 'PIYASA: BIST30/TL — Türkiye makro dinamikleri, TCMB faizi, TL kuru öncelikli. BIST30 hisselerini tercih et.'
    : 'PIYASA: GLOBAL/USD — Fed politikası, küresel likidite öncelikli.'

  const systemPrompt = `Sen finansal bir analistsin. Haber metnini analiz edip YALNIZCA haberde ADI GEÇEN veya haberin DOĞRUDAN ETKİLEDİĞİ finansal enstrümanları tespit edeceksin.

ZORUNLU KURALLAR:
1. Haberde adı geçen şirket varsa → o şirketin borsa sembolünü yaz (L'Oreal → OR.PA, Apple → AAPL, Garanti → GARAN)
2. Haberde adı geçen emtia varsa → sembolünü yaz (altın → GC=F, petrol → CL=F, bitcoin → BTC-USD)
3. Haber doğrudan döviz/faiz politikası hakkındaysa → döviz sembolü ekle (USDTRY=X, EURUSD=X)
4. Haber genel ekonomi, siyaset, doğal afet, sosyal konu ise → etkilenen_enstrumanlar BOŞ ARRAY döndür []
5. "Hisse Senetleri", "Kripto Para", "Emtia Piyasası", "Döviz Kuru" gibi KATEGORİ İSİMLERİ KESİNLİKLE YASAK
6. Haberde geçmeyen, sadece sektörel çıkarım yaptığın enstrümanları EKLEME — emin değilsen EKLEME
7. Yanıtı Türkçe geçerli JSON olarak döndür, başka metin ekleme`

  const userPrompt = `${piyasaBaglami}

Haber:
"""
${haberMetni}
"""

JSON:
{
  "haber_ozeti": "Piyasa etkisini 2 cümlede özetle.",
  "piyasa_etkisi": "Pozitif / Negatif / Nötr",
  "etki_suresi": "Kısa Vadeli (Günlük/Haftalık) veya Orta-Uzun Vadeli",
  "etkilenen_sektorler": ["Haberde geçen spesifik sektör, yoksa boş array"],
  "etkilenen_enstrumanlar": [
    {
      "enstruman_adi": "Sembol — SADECE haberde adı geçen veya doğrudan etkilenen enstrüman",
      "yonu": "Yukarı / Aşağı / Belirsiz",
      "gerekce": "Haberin hangi cümlesi/verisi bu enstrümanı etkiliyor — somut gerekçe"
    }
  ],
  "risk_puani": 5
}`

  let chat
  try {
    chat = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
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
