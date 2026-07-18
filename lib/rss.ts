export interface NewsItem {
  id: string
  source: string
  title: string
  link: string
  pubDate: string
  analysis?: string
}

const FEEDS = [
  { url: 'https://feeds.feedburner.com/zerohedge/feed', name: 'ZeroHedge' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw-realtimeheadlines', name: 'Dow Jones' },
  { url: 'https://www.investing.com/rss/news.rss', name: 'Investing.com' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories', name: 'MarketWatch' },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', name: 'Bloomberg' },
]

async function fetchRSS(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (!text.includes('<item>')) return null
    return text
  } catch {
    return null
  }
}

function parseRSSItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const block = match[1]
    const title =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ??
      ''
    const link =
      block.match(/<link>(.*?)<\/link>/)?.[1] ??
      block.match(/<guid isPermaLink="true">(.*?)<\/guid>/)?.[1] ??
      ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? new Date().toUTCString()

    const cleaned = title.replace(/<[^>]+>/g, '').trim()
    if (!cleaned) continue

    const id = Buffer.from(link || cleaned).toString('base64').slice(0, 16)
    items.push({ id, source, title: cleaned, link, pubDate })
  }

  return items.slice(0, 15)
}

export async function fetchAllFeeds(): Promise<NewsItem[]> {
  const fetches = FEEDS.map(async ({ url, name }) => {
    const xml = await fetchRSS(url)
    if (!xml) {
      console.warn(`Could not fetch ${name}`)
      return []
    }
    console.log(`Fetched ${name}`)
    return parseRSSItems(xml, name)
  })

  const settled = await Promise.allSettled(fetches)
  const results: NewsItem[] = []

  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value)
  }

  return results.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  )
}
