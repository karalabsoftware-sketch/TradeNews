import type { OHLCV } from './indicators'

// Ticker normalizasyonu
export function normalizeTicker(raw: string): string {
  const t = raw.trim().toUpperCase()
  // BIST hisseleri
  const bist = ['THYAO','GARAN','AKBNK','EREGL','SISE','KCHOL','BIMAS','ASELS','TUPRS','PGSUS',
    'ISCTR','VAKBN','HALKB','YKBNK','TOASO','FROTO','DOHOL','SAHOL','KOZAL','ENKAI']
  if (bist.includes(t) || (t.length <= 5 && !t.includes('.'))) {
    // Türk hissesi olabilir, .IS ekle (zaten .IS varsa ekleme)
    if (!t.endsWith('.IS') && bist.includes(t)) return `${t}.IS`
  }
  return t
}

export async function fetchOHLCV(ticker: string, bars = 250): Promise<OHLCV[]> {
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - bars * 2 * 86400 // 2x buffer (hafta sonları için)

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}&events=history`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} for ${ticker}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`No data for ${ticker}`)

  const timestamps: number[] = result.timestamp ?? []
  const q = result.indicators?.quote?.[0]
  if (!q || timestamps.length === 0) throw new Error(`Empty quote for ${ticker}`)

  const ohlcv: OHLCV[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i]
    if (o == null || h == null || l == null || c == null) continue
    ohlcv.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      open: o, high: h, low: l, close: c, volume: v ?? 0,
    })
  }

  if (ohlcv.length < 30) throw new Error(`Insufficient data for ${ticker}: ${ohlcv.length} bars`)
  return ohlcv.slice(-bars)
}
