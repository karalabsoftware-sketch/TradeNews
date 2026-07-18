import type { NewsItem } from './rss'

const BASE = process.env.KV_REST_API_URL!
const TOKEN = process.env.KV_REST_API_TOKEN!
const NEWS_KEY = 'news:items'
const MAX_ITEMS = 500

async function kvGet<T>(key: string): Promise<T | null> {
  const res = await fetch(`${BASE}/get/${key}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const json = await res.json()
  if (json.result === null || json.result === undefined) return null
  try {
    return typeof json.result === 'string' ? JSON.parse(json.result) : json.result
  } catch {
    return null
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value)
  await fetch(`${BASE}/set/${key}/${encodeURIComponent(serialized)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKEN}` },
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

export async function getNews(): Promise<NewsItem[]> {
  return (await kvGet<NewsItem[]>(NEWS_KEY)) ?? []
}

export async function updateAnalysis(id: string, analysis: string): Promise<void> {
  const items: NewsItem[] = (await kvGet<NewsItem[]>(NEWS_KEY)) ?? []
  const idx = items.findIndex((n) => n.id === id)
  if (idx === -1) return
  items[idx].analysis = analysis
  await kvSet(NEWS_KEY, items)
}
