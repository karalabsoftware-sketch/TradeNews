'use client'

import { useEffect, useState } from 'react'

interface Enstruman { enstruman_adi: string; yonu: string; gerekce: string }
interface Analiz {
  haber_ozeti: string; piyasa_etkisi: string; etki_suresi: string
  etkilenen_sektorler: string[]; etkilenen_enstrumanlar: Enstruman[]; risk_puani: number
}
interface TeknikAnaliz {
  genel_gorunum: string; ozet: string; rsi_yorum: string; macd_yorum: string
  hareketli_ortalama_yorum: string; bollinger_yorum: string; hacim_yorum: string
  kritik_seviyeler: { guclu_destek: number; guclu_direnc: number; hedef_yukari: number; hedef_asagi: number }
  kirilim_senaryolari: { yukari_kirilim: string; asagi_kirilim: string }
  risk_seviyesi: string; teknik_puan: number
}
interface TeknikVeri {
  ticker: string; fiyat: number; degisim_yuzde: number
  rsi14: number; ema20: number; ema50: number; ema200: number
  macd: number; macd_sinyal: number; macd_histogram: number
  bb_ust: number; bb_orta: number; bb_alt: number
  atr14: number; destek: number; direnc: number; trend: string
}
interface NewsItem {
  id: string; source: string; title: string; link: string
  pubDate: string; summary?: string; analysis?: string
}

function parseJSON<T>(raw: string): T | null {
  try { return JSON.parse(raw) } catch { return null }
}

function RiskBar({ puan, max = 10 }: { puan: number; max?: number }) {
  const clamped = Math.min(Math.max(Math.round(puan), 1), max)
  const c = clamped <= 3 ? '#4caf50' : clamped <= 5 ? '#ffc107' : clamped <= 7 ? '#ff9800' : '#f44336'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#888' }}>Risk:</span>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: i < clamped ? c : '#333' }} />
      ))}
      <span style={{ fontSize: 11, color: c }}>{clamped}/{max}</span>
    </div>
  )
}

function AnalizKart({ analiz }: { analiz: Analiz }) {
  const etkiRenk = analiz.piyasa_etkisi === 'Pozitif' ? '#4caf50' : analiz.piyasa_etkisi === 'Negatif' ? '#f44336' : '#ffc107'
  return (
    <div style={s.analizBox}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <span style={{ ...s.badge, background: etkiRenk + '22', color: etkiRenk, border: `1px solid ${etkiRenk}44` }}>{analiz.piyasa_etkisi}</span>
        <span style={{ ...s.badge, background: '#1e1e1e', color: '#aaa' }}>{analiz.etki_suresi}</span>
        <RiskBar puan={analiz.risk_puani} />
      </div>
      <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, margin: '0 0 10px' }}>{analiz.haber_ozeti}</p>
      {analiz.etkilenen_sektorler?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#888' }}>Sektörler: </span>
          {analiz.etkilenen_sektorler.map(sec => <span key={sec} style={{ ...s.badge, background: '#1a2a3a', color: '#64b5f6', marginLeft: 4 }}>{sec}</span>)}
        </div>
      )}
      {analiz.etkilenen_enstrumanlar?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {analiz.etkilenen_enstrumanlar.map((e, i) => (
            <div key={i} style={s.enstrumanRow}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{e.enstruman_adi}</span>
                <span style={{ fontSize: 11, color: e.yonu === 'Yukarı' ? '#4caf50' : e.yonu === 'Aşağı' ? '#f44336' : '#ffc107' }}>
                  {e.yonu === 'Yukarı' ? '▲' : e.yonu === 'Aşağı' ? '▼' : '◆'} {e.yonu}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#999', margin: 0, lineHeight: 1.5 }}>{e.gerekce}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TeknikAnalizPanel({ ticker, teknikVeri, analiz, onClose }: {
  ticker: string; teknikVeri: TeknikVeri; analiz: TeknikAnaliz; onClose: () => void
}) {
  const gorunumRenk = analiz.genel_gorunum === 'Boğa' ? '#4caf50' : analiz.genel_gorunum === 'Ayı' ? '#f44336' : '#ffc107'
  const degisimRenk = teknikVeri.degisim_yuzde >= 0 ? '#4caf50' : '#f44336'
  return (
    <div style={s.teknikPanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{ticker}</span>
          <span style={{ fontSize: 16, color: '#fff' }}>{teknikVeri.fiyat}</span>
          <span style={{ fontSize: 13, color: degisimRenk }}>{teknikVeri.degisim_yuzde > 0 ? '+' : ''}{teknikVeri.degisim_yuzde}%</span>
          <span style={{ ...s.badge, background: gorunumRenk + '22', color: gorunumRenk, border: `1px solid ${gorunumRenk}44` }}>{analiz.genel_gorunum}</span>
          <span style={{ ...s.badge, background: '#1e1e1e', color: '#aaa' }}>Teknik Puan: {analiz.teknik_puan}/10</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>

      <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, margin: '0 0 12px' }}>{analiz.ozet}</p>

      <div style={s.indikatörGrid}>
        <div style={s.indikatörKart}>
          <div style={s.indikatörBaslik}>RSI (14)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: teknikVeri.rsi14 > 70 ? '#f44336' : teknikVeri.rsi14 < 30 ? '#4caf50' : '#fff' }}>{teknikVeri.rsi14}</div>
          <div style={s.indikatörAciklama}>{analiz.rsi_yorum}</div>
        </div>
        <div style={s.indikatörKart}>
          <div style={s.indikatörBaslik}>MACD</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: teknikVeri.macd_histogram > 0 ? '#4caf50' : '#f44336' }}>
            {teknikVeri.macd.toFixed(3)}
          </div>
          <div style={s.indikatörAciklama}>{analiz.macd_yorum}</div>
        </div>
        <div style={s.indikatörKart}>
          <div style={s.indikatörBaslik}>Hareketli Ortalamalar</div>
          <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
            <div>EMA20: <span style={{ color: '#fff' }}>{teknikVeri.ema20}</span></div>
            <div>EMA50: <span style={{ color: '#fff' }}>{teknikVeri.ema50}</span></div>
            <div>EMA200: <span style={{ color: '#fff' }}>{teknikVeri.ema200}</span></div>
          </div>
          <div style={s.indikatörAciklama}>{analiz.hareketli_ortalama_yorum}</div>
        </div>
        <div style={s.indikatörKart}>
          <div style={s.indikatörBaslik}>Bollinger Bands</div>
          <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.8 }}>
            <div>Üst: <span style={{ color: '#f44336' }}>{teknikVeri.bb_ust}</span></div>
            <div>Orta: <span style={{ color: '#fff' }}>{teknikVeri.bb_orta}</span></div>
            <div>Alt: <span style={{ color: '#4caf50' }}>{teknikVeri.bb_alt}</span></div>
          </div>
          <div style={s.indikatörAciklama}>{analiz.bollinger_yorum}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={s.seviyeKart}>
          <span style={{ fontSize: 11, color: '#4caf50' }}>▲ Güçlü Direnç</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{analiz.kritik_seviyeler.guclu_direnc}</span>
        </div>
        <div style={s.seviyeKart}>
          <span style={{ fontSize: 11, color: '#f44336' }}>▼ Güçlü Destek</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{analiz.kritik_seviyeler.guclu_destek}</span>
        </div>
        <div style={s.seviyeKart}>
          <span style={{ fontSize: 11, color: '#4caf50' }}>🎯 Yukarı Hedef</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#4caf50' }}>{analiz.kritik_seviyeler.hedef_yukari}</span>
        </div>
        <div style={s.seviyeKart}>
          <span style={{ fontSize: 11, color: '#f44336' }}>🎯 Aşağı Hedef</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f44336' }}>{analiz.kritik_seviyeler.hedef_asagi}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <div style={{ ...s.senaryoKart, borderColor: '#4caf5044' }}>
          <div style={{ fontSize: 11, color: '#4caf50', marginBottom: 4 }}>▲ Yukarı Kırılım Senaryosu</div>
          <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>{analiz.kirilim_senaryolari.yukari_kirilim}</div>
        </div>
        <div style={{ ...s.senaryoKart, borderColor: '#f4433644' }}>
          <div style={{ fontSize: 11, color: '#f44336', marginBottom: 4 }}>▼ Aşağı Kırılım Senaryosu</div>
          <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>{analiz.kirilim_senaryolari.asagi_kirilim}</div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')
  const [teknikState, setTeknikState] = useState<Record<string, { loading: boolean; ticker: string; data?: { teknikVeri: TeknikVeri; analiz: TeknikAnaliz } }>>({})
  const [manuelTicker, setManuelTicker] = useState<Record<string, string>>({})

  const sources = ['All', 'ZeroHedge', 'CNBC Markets', 'Investing.com', 'MarketWatch', 'Bloomberg']

  async function loadNews() {
    const res = await fetch('/api/news')
    const data = await res.json()
    setNews(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try { await fetch('/api/refresh', { method: 'POST' }); await loadNews() }
    catch (e) { console.error(e) }
    setRefreshing(false)
  }

  async function handleAnalyze(item: NewsItem) {
    setAnalyzingId(item.id)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, title: item.title, link: item.link, summary: item.summary }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { analysis } = await res.json()
      setNews(prev => prev.map(n => n.id === item.id ? { ...n, analysis } : n))
    } catch (e) { console.error('Analyze error:', e) }
    setAnalyzingId(null)
  }

  async function handleTeknikAnaliz(newsId: string, ticker: string) {
    if (!ticker.trim()) return
    setTeknikState(prev => ({ ...prev, [newsId]: { loading: true, ticker } }))
    try {
      const res = await fetch('/api/technical', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTeknikState(prev => ({ ...prev, [newsId]: { loading: false, ticker, data } }))
    } catch (e) {
      console.error('Technical error:', e)
      setTeknikState(prev => ({ ...prev, [newsId]: { loading: false, ticker } }))
    }
  }

  useEffect(() => { loadNews() }, [])

  const filtered = filter === 'All' ? news : news.filter(n => n.source === filter)

  if (loading) return <div style={s.center}>Yükleniyor...</div>

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}>📈 TradeNews</h1>
        <button onClick={handleRefresh} disabled={refreshing} style={s.refreshBtn}>
          {refreshing ? 'Çekiliyor...' : '🔄 Yenile'}
        </button>
      </div>

      <div style={s.filters}>
        {sources.map(src => (
          <button key={src} onClick={() => setFilter(src)} style={{ ...s.filterBtn, ...(filter === src ? s.filterActive : {}) }}>{src}</button>
        ))}
      </div>

      <div style={s.list}>
        {filtered.length === 0 && <p style={{ color: '#888' }}>Haber bulunamadı. Yenile butonuna bas.</p>}
        {filtered.map(item => {
          const analiz = item.analysis ? parseJSON<Analiz>(item.analysis) : null
          const teknik = teknikState[item.id]
          return (
            <div key={item.id} style={s.card}>
              <div style={s.cardHeader}>
                <span style={s.source}>{item.source}</span>
                <span style={s.date}>{new Date(item.pubDate).toLocaleString('tr-TR')}</span>
              </div>
              <a href={item.link} target="_blank" rel="noreferrer" style={s.titleLink}>{item.title}</a>

              {analiz ? <AnalizKart analiz={analiz} /> : (
                <button onClick={() => handleAnalyze(item)} disabled={analyzingId === item.id} style={s.analyzeBtn}>
                  {analyzingId === item.id ? '⏳ Analiz ediliyor...' : '🤖 AI Haber Analizi'}
                </button>
              )}

              {analiz && (
                <div style={{ marginTop: 8 }}>
                  {!teknik?.data && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                      {analiz.etkilenen_enstrumanlar?.map(e => (
                        <button key={e.enstruman_adi} onClick={() => handleTeknikAnaliz(item.id, e.enstruman_adi)}
                          disabled={teknik?.loading} style={s.teknikBtn}>
                          📊 {e.enstruman_adi}
                        </button>
                      ))}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          placeholder="Manuel ticker (AAPL, THYAO...)"
                          value={manuelTicker[item.id] ?? ''}
                          onChange={e => setManuelTicker(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleTeknikAnaliz(item.id, manuelTicker[item.id] ?? '')}
                          style={s.tickerInput}
                        />
                        <button onClick={() => handleTeknikAnaliz(item.id, manuelTicker[item.id] ?? '')}
                          disabled={teknik?.loading || !manuelTicker[item.id]} style={s.teknikBtn}>
                          {teknik?.loading ? '⏳' : '📊'}
                        </button>
                      </div>
                    </div>
                  )}

                  {teknik?.loading && <div style={{ fontSize: 12, color: '#888' }}>⏳ Teknik analiz hesaplanıyor...</div>}

                  {teknik?.data && (
                    <TeknikAnalizPanel
                      ticker={teknik.ticker}
                      teknikVeri={teknik.data.teknikVeri}
                      analiz={teknik.data.analiz}
                      onClose={() => setTeknikState(prev => { const n = { ...prev }; delete n[item.id]; return n })}
                    />
                  )}

                  {!teknik?.loading && !teknik?.data && teknik !== undefined && (
                    <div style={{ fontSize: 12, color: '#f44336' }}>⚠ Teknik veri alınamadı. Ticker formatını kontrol et (örn: THYAO, BTC-USD, GC=F)</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 860, margin: '0 auto', padding: '20px 16px', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', minHeight: '100vh', color: '#e0e0e0' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f0f0f', color: '#e0e0e0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, fontSize: 24, color: '#fff' },
  refreshBtn: { padding: '8px 16px', background: '#1d9bf0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  filterBtn: { padding: '4px 12px', background: '#1e1e1e', color: '#aaa', border: '1px solid #333', borderRadius: 20, cursor: 'pointer', fontSize: 12 },
  filterActive: { background: '#1d9bf0', color: '#fff', borderColor: '#1d9bf0' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 },
  source: { fontSize: 12, color: '#1d9bf0', fontWeight: 600 },
  date: { fontSize: 11, color: '#666' },
  titleLink: { display: 'block', color: '#e0e0e0', textDecoration: 'none', fontSize: 14, lineHeight: 1.5, marginBottom: 10 },
  analyzeBtn: { padding: '6px 12px', background: '#1e1e1e', color: '#888', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  teknikBtn: { padding: '5px 10px', background: '#1a2a1a', color: '#4caf50', border: '1px solid #4caf5044', borderRadius: 6, cursor: 'pointer', fontSize: 11 },
  tickerInput: { padding: '5px 8px', background: '#1e1e1e', color: '#fff', border: '1px solid #333', borderRadius: 6, fontSize: 12, width: 160, outline: 'none' },
  analizBox: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 14px', marginTop: 4 },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600 },
  enstrumanRow: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '8px 10px' },
  teknikPanel: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 10, padding: '14px', marginTop: 10 },
  indikatörGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 },
  indikatörKart: { background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '10px 12px' },
  indikatörBaslik: { fontSize: 11, color: '#8b949e', marginBottom: 4, fontWeight: 600 },
  indikatörAciklama: { fontSize: 11, color: '#8b949e', marginTop: 6, lineHeight: 1.5 },
  seviyeKart: { display: 'flex', flexDirection: 'column', gap: 2, background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '8px 12px', flex: 1, minWidth: 100 },
  senaryoKart: { flex: 1, background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '10px 12px' },
}
