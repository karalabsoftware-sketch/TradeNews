import { NextResponse } from 'next/server'
import { fetchAllFeeds } from '@/lib/rss'
import { saveNews } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const items = await fetchAllFeeds()
  const byPiyasa = { global: items.filter(n => n.piyasa === 'global').length, bist: items.filter(n => n.piyasa === 'bist').length }
  console.log('fetchAllFeeds total:', items.length, 'byPiyasa:', JSON.stringify(byPiyasa))
  const saved = await saveNews(items)
  return NextResponse.json({ fetched: items.length, saved, byPiyasa })
}
