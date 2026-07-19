export interface OHLCV {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TeknikVeri {
  ticker: string
  fiyat: number
  degisim_yuzde: number
  rsi14: number
  ema20: number
  ema50: number
  ema200: number
  macd: number
  macd_sinyal: number
  macd_histogram: number
  bb_ust: number
  bb_orta: number
  bb_alt: number
  atr14: number
  hacim_ort20: number
  guncel_hacim: number
  destek: number
  direnc: number
  trend: 'yukari' | 'asagi' | 'yatay'
}

// Basit hareketli ortalama
function sma(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    const slice = data.slice(i - period + 1, i + 1)
    result.push(slice.reduce((a, b) => a + b, 0) / period)
  }
  return result
}

// Üstel hareketli ortalama
function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = NaN
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    if (i === period - 1) {
      prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period
      result.push(prev)
      continue
    }
    prev = data[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

// RSI hesaplama (Wilder's smoothing)
function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += Math.abs(diff)
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period; i < closes.length; i++) {
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result[i] = 100 - 100 / (1 + rs)
      continue
    }
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result[i] = 100 - 100 / (1 + rs)
  }
  return result
}

// MACD (12, 26, 9)
function macd(closes: number[]): { macd: number[]; sinyal: number[]; histogram: number[] } {
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const macdLine = ema12.map((v, i) => (isNaN(v) || isNaN(ema26[i])) ? NaN : v - ema26[i])
  const validMacd = macdLine.filter(v => !isNaN(v))
  const signalRaw = ema(validMacd, 9)
  const sinyal: number[] = new Array(macdLine.length).fill(NaN)
  let si = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) { sinyal[i] = signalRaw[si++] ?? NaN }
  }
  const histogram = macdLine.map((v, i) => (isNaN(v) || isNaN(sinyal[i])) ? NaN : v - sinyal[i])
  return { macd: macdLine, sinyal, histogram }
}

// Bollinger Bands (20, 2σ)
function bollingerBands(closes: number[], period = 20, mult = 2): { ust: number[]; orta: number[]; alt: number[] } {
  const orta = sma(closes, period)
  const ust: number[] = []
  const alt: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(orta[i])) { ust.push(NaN); alt.push(NaN); continue }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = orta[i]
    const std = Math.sqrt(slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period)
    ust.push(mean + mult * std)
    alt.push(mean - mult * std)
  }
  return { ust, orta, alt }
}

// ATR (Average True Range)
function atr(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const tr: number[] = [highs[0] - lows[0]]
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
  }
  // Wilder smoothing
  const result: number[] = new Array(closes.length).fill(NaN)
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period - 1] = prev
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period
    result[i] = prev
  }
  return result
}

// Destek ve direnç (son 50 barda pivot high/low)
function destekDirenc(highs: number[], lows: number[], closes: number[], lookback = 50): { destek: number; direnc: number } {
  const son = Math.min(lookback, closes.length)
  const recentHighs = highs.slice(-son)
  const recentLows = lows.slice(-son)
  const guncelFiyat = closes[closes.length - 1]

  // Pivot noktaları: komşularından yüksek/düşük olanlar
  const pivotHighs: number[] = []
  const pivotLows: number[] = []
  for (let i = 2; i < recentHighs.length - 2; i++) {
    if (recentHighs[i] > recentHighs[i-1] && recentHighs[i] > recentHighs[i-2] &&
        recentHighs[i] > recentHighs[i+1] && recentHighs[i] > recentHighs[i+2]) {
      pivotHighs.push(recentHighs[i])
    }
    if (recentLows[i] < recentLows[i-1] && recentLows[i] < recentLows[i-2] &&
        recentLows[i] < recentLows[i+1] && recentLows[i] < recentLows[i+2]) {
      pivotLows.push(recentLows[i])
    }
  }

  // Güncel fiyatın altındaki en yakın pivot = destek
  // Güncel fiyatın üstündeki en yakın pivot = direnç
  const destekler = pivotLows.filter(p => p < guncelFiyat).sort((a, b) => b - a)
  const direngler = pivotHighs.filter(p => p > guncelFiyat).sort((a, b) => a - b)

  return {
    destek: destekler[0] ?? Math.min(...recentLows),
    direnc: direngler[0] ?? Math.max(...recentHighs),
  }
}

// Trend tespiti: EMA20 > EMA50 > EMA200 = güçlü yukarı
function trendTespit(fiyat: number, ema20: number, ema50: number, ema200: number): 'yukari' | 'asagi' | 'yatay' {
  const yukariSkor = [fiyat > ema20, fiyat > ema50, fiyat > ema200, ema20 > ema50, ema50 > ema200].filter(Boolean).length
  if (yukariSkor >= 4) return 'yukari'
  if (yukariSkor <= 1) return 'asagi'
  return 'yatay'
}

export function hesaplaTeknikVeri(ticker: string, bars: OHLCV[]): TeknikVeri {
  if (bars.length < 30) throw new Error('Yetersiz veri')

  const closes = bars.map(b => b.close)
  const highs = bars.map(b => b.high)
  const lows = bars.map(b => b.low)
  const volumes = bars.map(b => b.volume)
  const n = closes.length

  const rsiArr = rsi(closes, 14)
  const ema20Arr = ema(closes, 20)
  const ema50Arr = ema(closes, 50)
  const ema200Arr = ema(closes, 200)
  const macdData = macd(closes)
  const bb = bollingerBands(closes, 20, 2)
  const atrArr = atr(highs, lows, closes, 14)
  const hacimOrt = sma(volumes, 20)
  const { destek, direnc } = destekDirenc(highs, lows, closes, 50)

  const fiyat = closes[n - 1]
  const oncekiFiyat = closes[n - 2]

  return {
    ticker,
    fiyat: +fiyat.toFixed(4),
    degisim_yuzde: +((fiyat - oncekiFiyat) / oncekiFiyat * 100).toFixed(2),
    rsi14: +rsiArr[n - 1].toFixed(2),
    ema20: +ema20Arr[n - 1].toFixed(4),
    ema50: +ema50Arr[n - 1].toFixed(4),
    ema200: +ema200Arr[n - 1].toFixed(4),
    macd: +macdData.macd[n - 1].toFixed(4),
    macd_sinyal: +macdData.sinyal[n - 1].toFixed(4),
    macd_histogram: +macdData.histogram[n - 1].toFixed(4),
    bb_ust: +bb.ust[n - 1].toFixed(4),
    bb_orta: +bb.orta[n - 1].toFixed(4),
    bb_alt: +bb.alt[n - 1].toFixed(4),
    atr14: +atrArr[n - 1].toFixed(4),
    hacim_ort20: +hacimOrt[n - 1].toFixed(0),
    guncel_hacim: volumes[n - 1],
    destek: +destek.toFixed(4),
    direnc: +direnc.toFixed(4),
    trend: trendTespit(fiyat, ema20Arr[n - 1], ema50Arr[n - 1], ema200Arr[n - 1]),
  }
}
