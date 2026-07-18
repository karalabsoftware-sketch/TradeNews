import { NextResponse } from 'next/server'
import { fetchAllFeeds } from '@/lib/rss'
import { saveNews } from '@/lib/store'

export const maxDuration = 60

export async function POST() {
  const items = await fetchAllFeeds()
  const saved = await saveNews(items)
  return NextResponse.json({ fetched: items.length, saved })
}
