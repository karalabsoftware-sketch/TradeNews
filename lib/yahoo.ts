import type { OHLCV } from './indicators'

// Ticker normalizasyonu
export function normalizeTicker(raw: string): string {
  // Parantez içeriğini çıkar: "Bitcoin (BTC)" → "BTC"
  const cleaned = raw.replace(/^.*?\(([^)]+)\).*$/, '$1').trim()
  const t = cleaned.toUpperCase()

  // Zaten geçerli Yahoo formatı
  if (t.includes('-') || t.includes('=') || t.includes('.')) return t

  const MAP: Record<string, string> = {
    // --- Kripto ---
    'BITCOIN': 'BTC-USD', 'BTC': 'BTC-USD',
    'ETHEREUM': 'ETH-USD', 'ETH': 'ETH-USD',
    'SOLANA': 'SOL-USD', 'SOL': 'SOL-USD',
    'RIPPLE': 'XRP-USD', 'XRP': 'XRP-USD',
    'BINANCECOIN': 'BNB-USD', 'BNB': 'BNB-USD',
    'CARDANO': 'ADA-USD', 'ADA': 'ADA-USD',
    'DOGECOIN': 'DOGE-USD', 'DOGE': 'DOGE-USD',
    'AVALANCHE': 'AVAX-USD', 'AVAX': 'AVAX-USD',
    'POLKADOT': 'DOT-USD', 'DOT': 'DOT-USD',
    'CHAINLINK': 'LINK-USD', 'LINK': 'LINK-USD',
    'LITECOIN': 'LTC-USD', 'LTC': 'LTC-USD',
    'UNISWAP': 'UNI-USD', 'UNI': 'UNI-USD',
    'STELLAR': 'XLM-USD', 'XLM': 'XLM-USD',
    'TONCOIN': 'TON-USD', 'TON': 'TON-USD',
    'SHIBA': 'SHIB-USD', 'SHIB': 'SHIB-USD',
    // --- Emtia ---
    'ALTIN': 'GC=F', 'GOLD': 'GC=F', 'XAU': 'GC=F', 'ALTIN FIYATI': 'GC=F',
    'GUMUS': 'SI=F', 'GÜMÜŞ': 'SI=F', 'SILVER': 'SI=F', 'XAG': 'SI=F',
    'PETROL': 'CL=F', 'OIL': 'CL=F', 'WTI': 'CL=F', 'HAM PETROL': 'CL=F',
    'BRENT': 'BZ=F', 'BRENT PETROL': 'BZ=F',
    'DOGALGAZ': 'NG=F', 'DOĞALGAZ': 'NG=F', 'NATURALGAS': 'NG=F', 'NATURAL GAS': 'NG=F',
    'BAKIR': 'HG=F', 'COPPER': 'HG=F',
    'PLATIN': 'PL=F', 'PLATINUM': 'PL=F',
    'PALADYUM': 'PA=F', 'PALLADIUM': 'PA=F',
    'MISIR': 'ZC=F', 'CORN': 'ZC=F',
    'BUGDAY': 'ZW=F', 'BUĞDAY': 'ZW=F', 'WHEAT': 'ZW=F',
    // --- Döviz (USD bazlı) ---
    'DOLAR': 'USDTRY=X', 'USD': 'USDTRY=X', 'USDTRY': 'USDTRY=X', 'AMERIKAN DOLARI': 'USDTRY=X',
    'EURO': 'EURTRY=X', 'EUR': 'EURTRY=X', 'EURTRY': 'EURTRY=X',
    'EURUSD': 'EURUSD=X',
    'STERLIN': 'GBPUSD=X', 'GBP': 'GBPUSD=X', 'GBPUSD': 'GBPUSD=X', 'İNGİLİZ STERLİNİ': 'GBPUSD=X',
    'GBPTRY': 'GBPTRY=X',
    'YEN': 'JPY=X', 'JAPON YENİ': 'JPY=X', 'JPY': 'JPY=X', 'USDJPY': 'JPY=X',
    'FRANK': 'CHF=X', 'İSVİÇRE FRANKI': 'CHF=X', 'CHF': 'CHF=X', 'USDCHF': 'CHF=X',
    'YUAN': 'CNY=X', 'ÇİN YUANI': 'CNY=X', 'CNY': 'CNY=X', 'RMB': 'CNY=X',
    'RUBLE': 'RUB=X', 'RUBLO': 'RUB=X', 'RUS RUBLESİ': 'RUB=X', 'RUS RUBLESI': 'RUB=X',
    'RUB': 'RUB=X', 'USDRUB': 'RUB=X', 'RUBL': 'RUB=X',
    'HINT RUPISI': 'INR=X', 'INR': 'INR=X', 'USDINR': 'INR=X',
    'REAL': 'BRL=X', 'BREZİLYA REALI': 'BRL=X', 'BRL': 'BRL=X',
    'RAND': 'ZAR=X', 'GÜNEY AFRİKA RANDI': 'ZAR=X', 'ZAR': 'ZAR=X',
    'AVUSTRALYA DOLARI': 'AUDUSD=X', 'AUD': 'AUDUSD=X', 'AUDUSD': 'AUDUSD=X',
    'KANADA DOLARI': 'CADUSD=X', 'CAD': 'CADUSD=X',
    'KORE WONU': 'KRW=X', 'KRW': 'KRW=X',
    // --- ABD Endeksleri ---
    'SP500': '^GSPC', 'S&P500': '^GSPC', 'S&P 500': '^GSPC', 'SPX': '^GSPC',
    'NASDAQ': '^IXIC', 'NASDAQ100': '^NDX', 'NDX': '^NDX', 'QQQ': 'QQQ',
    'DOW': '^DJI', 'DOWJONES': '^DJI', 'DOW JONES': '^DJI', 'DJI': '^DJI',
    'VIX': '^VIX', 'KORKU ENDEKSI': '^VIX',
    'RUSSELL2000': '^RUT', 'RUT': '^RUT',
    // --- Türkiye ---
    'BIST100': 'XU100.IS', 'BIST 100': 'XU100.IS', 'XU100': 'XU100.IS',
    'BIST30': 'XU030.IS', 'XU030': 'XU030.IS',
    // --- Popüler ABD Hisseleri ---
    'APPLE': 'AAPL', 'MICROSOFT': 'MSFT', 'GOOGLE': 'GOOGL', 'ALPHABET': 'GOOGL',
    'AMAZON': 'AMZN', 'TESLA': 'TSLA', 'META': 'META', 'NVIDIA': 'NVDA',
    'NETFLIX': 'NFLX', 'BERKSHIRE': 'BRK-B',
  }

  if (MAP[t]) return MAP[t]

  // Türkçe karakter normalize edip tekrar dene
  const normalized = t
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
  if (MAP[normalized]) return MAP[normalized]

  // BIST hissesi kontrolü (4-5 harf, .IS ekle)
  const bist = ['THYAO','GARAN','AKBNK','EREGL','SISE','KCHOL','BIMAS','ASELS','TUPRS','PGSUS',
    'ISCTR','VAKBN','HALKB','YKBNK','TOASO','FROTO','DOHOL','SAHOL','KOZAL','ENKAI',
    'PETKM','TCELL','ARCLK','MGROS','ULKER','CCOLA','EKGYO','TAVHL','ODAS','ENJSA']
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
