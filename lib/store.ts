import type { NewsItem } from './rss'

const BASE = process.env.KV_REST_API_URL!
const TOKEN = process.env.KV_REST_API_TOKEN!

console.log('KV BASE:', BASE)
console.log('KV TOKEN set:', !!TOKEN, 'length:', TOKEN?.length)
const NEWS_KEY = 'news_items'
const MAX_ITEMS = 500

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

async function kvGet<T>(key: string): Promise<T | null> {
  const res = await fetch(`${BASE}/get/${key}`, { headers })
  const json = await res.json()
  const result = json?.result
  if (result === null || result === undefined) return null
  try {
    return typeof result === 'string' ? JSON.parse(result) : result
  } catch {
    return null
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  await fetch(`${BASE}/set/${key}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(value),
  })
}

export async function saveNews(items: NewsItem[]): Promise<number> {
  const existing: NewsItem[] = (await kvGet<NewsItem[]>(NEWS_KEY)) ?? []
  const existingIds = new Set(existing.map((n) => n.id))

  const newItems = items.filter((item) => !existingIds.has(item.id))
  if (newItems.length === 0) return 0

  const merged = [...newItems, ...existing].slice(0, MAX_ITEMS)
  await kvSet(NEWS_KEY, merged)
  return newItems.length
}

export async function getNews(piyasa?: 'global' | 'bist'): Promise<NewsItem[]> {
  const all = (await kvGet<NewsItem[]>(NEWS_KEY)) ?? []
  if (!piyasa) return all
  return all.filter(n => (n.piyasa ?? 'global') === piyasa)
}

export async function updateAnalysis(id: string, analysis: string): Promise<void> {
  const items: NewsItem[] = (await kvGet<NewsItem[]>(NEWS_KEY)) ?? []
  const idx = items.findIndex((n) => n.id === id)
  if (idx === -1) return
  items[idx].analysis = analysis
  await kvSet(NEWS_KEY, items)
}
