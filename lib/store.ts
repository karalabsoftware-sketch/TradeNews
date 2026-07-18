import { kv } from '@vercel/kv'
import type { NewsItem } from './rss'

const NEWS_KEY = 'news:items'
const MAX_ITEMS = 500

export async function saveNews(items: NewsItem[]): Promise<number> {
  const existing: NewsItem[] = (await kv.get(NEWS_KEY)) ?? []
  const existingIds = new Set(existing.map((n) => n.id))

  const newItems = items.filter((item) => !existingIds.has(item.id))
  if (newItems.length === 0) return 0

  const merged = [...newItems, ...existing].slice(0, MAX_ITEMS)
  await kv.set(NEWS_KEY, merged)
  return newItems.length
}

export async function getNews(): Promise<NewsItem[]> {
  return (await kv.get(NEWS_KEY)) ?? []
}

export async function updateAnalysis(id: string, analysis: string): Promise<void> {
  const items: NewsItem[] = (await kv.get(NEWS_KEY)) ?? []
  const idx = items.findIndex((n) => n.id === id)
  if (idx === -1) return
  items[idx].analysis = analysis
  await kv.set(NEWS_KEY, items)
}
