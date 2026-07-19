import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { fetchOHLCV, normalizeTicker } from '@/lib/yahoo'
import { hesaplaTeknikVeri, type TeknikVeri, type OHLCV } from '@/lib/indicators'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function formatPrompt(v: TeknikVeri): string {
  const trendLabel = v.trend === 'yukari' ? 'Yukarı (Boğa)' : v.trend === 'asagi' ? 'Aşağı (Ayı)' : 'Yatay'
  const rsiDurum = v.rsi14 > 70 ? 'Aşırı Alım Bölgesi' : v.rsi14 < 30 ? 'Aşırı Satım Bölgesi' : 'Nötr Bölge'
  const macdDurum = v.macd_histogram > 0 ? 'Pozitif (Alım Baskısı)' : 'Negatif (Satış Baskısı)'
  const bbDurum = v.fiyat > v.bb_ust ? 'Üst Banda Yakın (Aşırı Alım)' : v.fiyat < v.bb_alt ? 'Alt Banda Yakın (Aşırı Satım)' : 'Bant İçinde'
  const hacimDurum = v.guncel_hacim > v.hacim_ort20 * 1.5 ? 'Ortalamanın Çok Üzerinde' : v.guncel_hacim > v.hacim_ort20 ? 'Ortalamanın Üzerinde' : 'Ortalamanın Altında'
  const fiyatEma = v.fiyat > v.ema200 ? 'EMA200 Üzerinde' : 'EMA200 Altında'

  return `Hisse/Enstrüman: ${v.ticker}
Güncel Fiyat: ${v.fiyat} (${v.degisim_yuzde > 0 ? '+' : ''}${v.degisim_yuzde}%)
Genel Trend: ${trendLabel}

Teknik İndikatör Verileri:
- RSI (14): ${v.rsi14} → ${rsiDurum}
- MACD: ${v.macd.toFixed(4)} | Sinyal: ${v.macd_sinyal.toFixed(4)} | Histogram: ${v.macd_histogram.toFixed(4)} → ${macdDurum}
- EMA20: ${v.ema20} | EMA50: ${v.ema50} | EMA200: ${v.ema200} → Fiyat ${fiyatEma}
- Bollinger Bands: Üst: ${v.bb_ust} | Orta: ${v.bb_orta} | Alt: ${v.bb_alt} → ${bbDurum}
- ATR (14): ${v.atr14} (Günlük volatilite ölçümü)
- Destek Seviyesi: ${v.destek}
- Direnç Seviyesi: ${v.direnc}
- Güncel Hacim: ${v.guncel_hacim.toLocaleString()} → ${hacimDurum} (20 günlük ort: ${v.hacim_ort20.toLocaleString()})`
}

export async function POST(req: NextRequest) {
  const { ticker: rawTicker } = await req.json()
  if (!rawTicker) return NextResponse.json({ error: 'Ticker gerekli' }, { status: 400 })

  // 1. Adım: normalizasyon tablosuyla dene
  let ticker = normalizeTicker(rawTicker)
  let bars: OHLCV[]
  try {
    bars = await fetchOHLCV(ticker, 250)
  } catch {
    // 2. Adım: Başarısız olduysa Groq'a ticker'ı sor
    try {
      const lookup = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `"${rawTicker}" ifadesinin Yahoo Finance'deki tam ticker sembolünü bul.
Sadece JSON döndür: {"ticker": "SEMBOL"}
Kurallar:
- Hisse senedi ise borsa suffix ekle (ABD: yok, BIST: .IS, Londra: .L vb.)
- Kripto ise -USD ekle (BTC-USD)
- Döviz kuru ise =X ekle (USDTRY=X)
- Emtia futures ise =F ekle (GC=F)
- Eğer halka açık işlem gören bir enstrüman değilse veya bulamazsan: {"ticker": ""}`
        }],
        max_tokens: 50,
      })
      const raw = lookup.choices[0].message.content ?? '{}'
      const resolved = JSON.parse(raw).ticker?.trim()
      if (!resolved) return NextResponse.json({ error: `Ticker çözümlenemedi: ${rawTicker}` }, { status: 422 })
      ticker = resolved
      bars = await fetchOHLCV(ticker, 250)
    } catch (e2) {
      return NextResponse.json({ error: `Veri çekilemedi: ${String(e2)}` }, { status: 422 })
    }
  }

  let teknikVeri: TeknikVeri
  try {
    teknikVeri = hesaplaTeknikVeri(ticker, bars)
  } catch (e) {
    return NextResponse.json({ error: `İndikatör hesaplanamadı: ${String(e)}` }, { status: 422 })
  }

  const prompt = formatPrompt(teknikVeri)

  let chat
  try {
    chat = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sen kıdemli bir teknik analist ve portföy yöneticisisin. Sana verilen matematiksel teknik indikatör verilerini kullanarak objektif, sayısal temelli bir teknik analiz raporu üreteceksin.
Kesinlikle tahmin veya yatırım tavsiyesi verme. Mevcut teknik verilerin ne söylediğini analitik bir dille açıkla.
Yanıtını her zaman Türkçe ve geçerli JSON formatında döndür. JSON dışında hiçbir metin ekleme.`,
        },
        {
          role: 'user',
          content: `Aşağıdaki teknik verileri analiz et ve JSON şablonuna birebir uyarak yanıt ver:

${prompt}

JSON Şablonu:
{
  "genel_gorunum": "Boğa / Ayı / Yatay",
  "ozet": "Mevcut teknik görünümün 2-3 cümlelik özeti.",
  "rsi_yorum": "RSI değerinin detaylı yorumu.",
  "macd_yorum": "MACD ve histogram durumunun yorumu.",
  "hareketli_ortalama_yorum": "EMA'ların birbirine göre konumu ve trend yorumu.",
  "bollinger_yorum": "Fiyatın bant içindeki konumu ve volatilite yorumu.",
  "hacim_yorum": "Hacim analizinin fiyat hareketini teyit edip etmediği.",
  "kritik_seviyeler": {
    "guclu_destek": ${0},
    "guclu_direnc": ${0},
    "hedef_yukari": ${0},
    "hedef_asagi": ${0}
  },
  "kirilim_senaryolari": {
    "yukari_kirilim": "Direnç kırılırsa olası senaryo.",
    "asagi_kirilim": "Destek kırılırsa olası senaryo."
  },
  "risk_seviyesi": "Düşük / Orta / Yüksek / Çok Yüksek",
  "teknik_puan": 6
}

Not: teknik_puan 1-10 arası (1: Çok Zayıf Teknik Görünüm, 10: Çok Güçlü Teknik Görünüm)`,
        },
      ],
      max_tokens: 800,
    })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    console.error('Groq technical error:', err.status, err.message)
    return NextResponse.json({ error: 'Groq failed' }, { status: 500 })
  }

  const raw = chat.choices[0].message.content ?? '{}'
  let analiz
  try { analiz = JSON.parse(raw) } catch { analiz = { ozet: raw } }

  return NextResponse.json({ ticker, teknikVeri, analiz })
}
