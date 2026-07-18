import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  const feeds = [
    { key: 'zerohedge', url: 'https://feeds.feedburner.com/zerohedge/feed' },
    { key: 'cnbc', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114' },
    { key: 'investing', url: 'https://www.investing.com/rss/news.rss' },
    { key: 'marketwatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories' },
    { key: 'bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  ]

  for (const { key, url } of feeds) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      })
      const text = await res.text()
      results[key] = { status: res.status, ok: res.ok, has_items: text.includes('<item>') }
    } catch (e) {
      results[key] = { error: String(e) }
    }
  }

  // KV test
  const BASE = process.env.KV_REST_API_URL
  const TOKEN = process.env.KV_REST_API_TOKEN
  results.kv = { url_set: !!BASE, token_set: !!TOKEN }

  return NextResponse.json(results)
}
