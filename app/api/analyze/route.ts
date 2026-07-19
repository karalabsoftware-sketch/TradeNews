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
    ? 'PIYASA: BIST30/TL — Türkiye ekonomisi, TCMB faizi, TL dinamikleri öncelikli.'
    : 'PIYASA: GLOBAL/USD — Fed politikası, küresel piyasalar öncelikli.'

  // Aşama 1: Haberi anla ve bağlamı çıkar
  let haberBaglami = haberMetni
  try {
    const ozet = await groq.chat.completions.create({
      model: MODEL,
      messages: [{
        role: 'user',
        content: `Aşağıdaki haber metnini oku ve şu soruları yanıtla (Türkçe, düz metin, 3-4 cümle):
- Bu haberin konusu tam olarak nedir?
- Hangi şirket, kurum, ülke veya ürün adları geçiyor?
- Haberin ekonomik/finansal önemi nedir?

Haber:
"""
${haberMetni}
"""`,
      }],
      max_tokens: 300,
    })
    const ctx = ozet.choices[0].message.content?.trim()
    if (ctx) haberBaglami = `${haberMetni}\n\n[Haber Bağlamı]: ${ctx}`
  } catch {
    // Aşama 1 başarısız olursa devam et
  }

  // Aşama 2: Finansal analiz
  const systemPrompt = `Sen deneyimli bir finansal analistsin. Sana verilen haberi ve bağlamını dikkatlice okuyarak detaylı bir piyasa analizi yapacaksın.

KURALLAR:
- haber_ozeti: Haberin piyasa açısından önemini, nedenini ve sonucunu açıklayan 3-4 cümle. "Fed politikası" gibi genel klişe cümleler YASAK — haberin spesifik içeriğini yaz.
- etkilenen_enstrumanlar: SADECE haberde adı geçen veya doğrudan ilişkili enstrümanlar. Haberde şirket adı geçiyorsa o şirketin sembolü (Apple→AAPL, Garanti→GARAN, L'Oreal→OR.PA). Emtia geçiyorsa sembolü (altın→GC=F). Döviz/faiz haberi değilse USDTRY ekleme. Emin değilsen boş bırak.
- gerekce: "Bu haber X şirketini şu nedenle etkiler: ..." şeklinde somut, habere özgü gerekçe.
- Yanıt Türkçe, geçerli JSON, başka metin yok.`

  const userPrompt = `${piyasaBaglami}

${haberBaglami}

JSON formatında yanıt ver:
{
  "haber_ozeti": "Haberin piyasa açısından önemi, spesifik detaylarla 3-4 cümle.",
  "piyasa_etkisi": "Pozitif / Negatif / Nötr",
  "etki_suresi": "Kısa Vadeli (Günlük/Haftalık) veya Orta-Uzun Vadeli",
  "etkilenen_sektorler": ["Spesifik sektör adı"],
  "etkilenen_enstrumanlar": [
    {
      "enstruman_adi": "Sembol — haberde geçen enstrüman",
      "yonu": "Yukarı / Aşağı / Belirsiz",
      "gerekce": "Haberin hangi spesifik bilgisi bu enstrümanı nasıl etkiliyor."
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
      max_tokens: 1000,
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
