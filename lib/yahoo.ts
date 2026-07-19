import type { OHLCV } from './indicators'

// Ticker normalizasyonu
export function normalizeTicker(raw: string): string {
  const t = raw.trim().toUpperCase()

  // Zaten geçerli Yahoo formatı (BTC-USD, GC=F, THYAO.IS vb.)
  if (t.includes('-') || t.includes('=') || t.includes('.')) return t

  // Kripto isim/sembol eşlemesi
  const kripto: Record<string, string> = {
    'BITCOIN': 'BTC-USD', 'BTC': 'BTC-USD',
    'ETHEREUM': 'ETH-USD', 'ETH': 'ETH-USD',
    'SOLANA': 'SOL-USD', 'SOL': 'SOL-USD',
    'RIPPLE': 'XRP-USD', 'XRP': 'XRP-USD',
    'BINANCECOIN': 'BNB-USD', 'BNB': 'BNB-USD',
    'CARDANO': 'ADA-USD', 'ADA': 'ADA-USD',
    'DOGECOIN': 'DOGE-USD', 'DOGE': 'DOGE-USD',
    'AVAX': 'AVAX-USD', 'AVALANCHE': 'AVAX-USD',
    'POLKADOT': 'DOT-USD', 'DOT': 'DOT-USD',
    'CHAINLINK': 'LINK-USD', 'LINK': 'LINK-USD',
  }
  if (kripto[t]) return kripto[t]

  // Emtia eşlemesi
  const emtia: Record<string, string> = {
    'ALTIN': 'GC=F', 'GOLD': 'GC=F', 'XAU': 'GC=F',
    'GUMUS': 'SI=F', 'SILVER': 'SI=F', 'XAG': 'SI=F',
    'PETROL': 'CL=F', 'OIL': 'CL=F', 'WTI': 'CL=F', 'BRENT': 'BZ=F',
    'DOGALGAZ': 'NG=F', 'NATURALGAS': 'NG=F',
    'BAKIR': 'HG=F', 'COPPER': 'HG=F',
    'PLATIN': 'PL=F', 'PLATINUM': 'PL=F',
  }
  if (emtia[t]) return emtia[t]

  // Döviz eşlemesi
  const doviz: Record<string, string> = {
    'USDTRY': 'USDTRY=X', 'DOLAR': 'USDTRY=X', 'USD': 'USDTRY=X',
    'EURTRY': 'EURTRY=X', 'EURO': 'EURTRY=X', 'EUR': 'EURTRY=X',
    'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X',
    'JPYUSD': 'JPYUSD=X', 'USDJPY': 'JPY=X',
  }
  if (doviz[t]) return doviz[t]

  // BIST hisseleri
  const bist = ['THYAO','GARAN','AKBNK','EREGL','SISE','KCHOL','BIMAS','ASELS','TUPRS','PGSUS',
    'ISCTR','VAKBN','HALKB','YKBNK','TOASO','FROTO','DOHOL','SAHOL','KOZAL','ENKAI']
  if (bist.includes(t)) return `${t}.IS`

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
