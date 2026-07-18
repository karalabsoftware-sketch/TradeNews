'use client'

import { useEffect, useState } from 'react'

interface NewsItem {
  id: string
  source: string
  title: string
  link: string
  pubDate: string
  analysis?: string
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
    } catch (e) {
      console.error(e)
    }
    setRefreshing(false)
  }

  async function handleAnalyze(item: NewsItem) {
    setAnalyzingId(item.id)
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, title: item.title }),
    })
    const { analysis } = await res.json()
    setNews((prev) => prev.map((n) => (n.id === item.id ? { ...n, analysis } : n)))
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
        {filtered.map((item) => (
          <div key={item.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.source}>{item.source}</span>
              <span style={styles.date}>{new Date(item.pubDate).toLocaleString('tr-TR')}</span>
            </div>
            <a href={item.link} target="_blank" rel="noreferrer" style={styles.titleLink}>
              {item.title}
            </a>
            {item.analysis ? (
              <div style={styles.analysis}>🤖 {item.analysis}</div>
            ) : (
              <button onClick={() => handleAnalyze(item)} disabled={analyzingId === item.id} style={styles.analyzeBtn}>
                {analyzingId === item.id ? 'Analiz ediliyor...' : '🤖 AI Analiz'}
              </button>
            )}
          </div>
        ))}
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
  analysis: { fontSize: 13, color: '#a0c4a0', background: '#0d1f0d', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 },
  analyzeBtn: { padding: '6px 12px', background: '#1e1e1e', color: '#888', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
}
