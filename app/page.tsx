'use client'

import { useEffect, useState } from 'react'

interface Enstruman {
  enstruman_adi: string
  yonu: string
  gerekce: string
}

interface Analiz {
  haber_ozeti: string
  piyasa_etkisi: string
  etki_suresi: string
  etkilenen_sektorler: string[]
  etkilenen_enstrumanlar: Enstruman[]
  risk_puani: number
}

interface NewsItem {
  id: string
  source: string
  title: string
  link: string
  pubDate: string
  summary?: string
  analysis?: string
}

function parseAnalysis(raw: string): Analiz | null {
  try { return JSON.parse(raw) } catch { return null }
}

function RiskBar({ puan }: { puan: number }) {
  const colors = ['', '#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: '#888' }}>Risk:</span>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: i <= puan ? colors[puan] : '#333' }} />
      ))}
      <span style={{ fontSize: 11, color: colors[puan] }}>{puan}/5</span>
    </div>
  )
}

function AnalizKart({ analiz }: { analiz: Analiz }) {
  const etkiRenk = analiz.piyasa_etkisi === 'Pozitif' ? '#4caf50' : analiz.piyasa_etkisi === 'Negatif' ? '#f44336' : '#ffc107'
  return (
    <div style={styles.analizBox}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <span style={{ ...styles.badge, background: etkiRenk + '22', color: etkiRenk, border: `1px solid ${etkiRenk}44` }}>
          {analiz.piyasa_etkisi}
        </span>
        <span style={{ ...styles.badge, background: '#1e1e1e', color: '#aaa' }}>{analiz.etki_suresi}</span>
        <RiskBar puan={analiz.risk_puani} />
      </div>

      <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, margin: '0 0 10px' }}>{analiz.haber_ozeti}</p>

      {analiz.etkilenen_sektorler?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#888' }}>Etkilenen Sektörler: </span>
          {analiz.etkilenen_sektorler.map(s => (
            <span key={s} style={{ ...styles.badge, background: '#1a2a3a', color: '#64b5f6', marginLeft: 4 }}>{s}</span>
          ))}
        </div>
      )}

      {analiz.etkilenen_enstrumanlar?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {analiz.etkilenen_enstrumanlar.map((e, i) => (
            <div key={i} style={styles.enstrumanRow}>
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

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')

  const sources = ['All', 'ZeroHedge', 'CNBC Markets', 'Investing.com', 'MarketWatch', 'Bloomberg']

  async function loadNews() {
    const res = await fetch('/api/news')
    const data = await res.json()
    setNews(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await fetch('/api/refresh', { method: 'POST' })
      await loadNews()
    } catch (e) { console.error(e) }
    setRefreshing(false)
  }

  async function handleAnalyze(item: NewsItem) {
    setAnalyzingId(item.id)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, title: item.title, link: item.link, summary: item.summary }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { analysis } = await res.json()
      setNews((prev) => prev.map((n) => (n.id === item.id ? { ...n, analysis } : n)))
    } catch (e) { console.error('Analyze error:', e) }
    setAnalyzingId(null)
  }

  useEffect(() => { loadNews() }, [])

  const filtered = filter === 'All' ? news : news.filter((n) => n.source === filter)

  if (loading) return <div style={styles.center}>Yükleniyor...</div>

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📈 TradeNews</h1>
        <button onClick={handleRefresh} disabled={refreshing} style={styles.refreshBtn}>
          {refreshing ? 'Çekiliyor...' : '🔄 Yenile'}
        </button>
      </div>

      <div style={styles.filters}>
        {sources.map((s) => (
          <button key={s} onClick={() => setFilter(s)} style={{ ...styles.filterBtn, ...(filter === s ? styles.filterActive : {}) }}>
            {s}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {filtered.length === 0 && <p style={{ color: '#888' }}>Haber bulunamadı. Yenile butonuna bas.</p>}
        {filtered.map((item) => {
          const analiz = item.analysis ? parseAnalysis(item.analysis) : null
          return (
            <div key={item.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.source}>{item.source}</span>
                <span style={styles.date}>{new Date(item.pubDate).toLocaleString('tr-TR')}</span>
              </div>
              <a href={item.link} target="_blank" rel="noreferrer" style={styles.titleLink}>
                {item.title}
              </a>
              {analiz ? (
                <AnalizKart analiz={analiz} />
              ) : (
                <button onClick={() => handleAnalyze(item)} disabled={analyzingId === item.id} style={styles.analyzeBtn}>
                  {analyzingId === item.id ? '⏳ Analiz ediliyor...' : '🤖 AI Analiz'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 800, margin: '0 auto', padding: '20px 16px', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', minHeight: '100vh', color: '#e0e0e0' },
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
  analizBox: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 14px', marginTop: 4 },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600 },
  enstrumanRow: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '8px 10px' },
}
