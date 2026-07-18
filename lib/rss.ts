export interface NewsItem {
  id: string
  source: string
  title: string
  link: string
  pubDate: string
  summary?: string
  analysis?: string
}

const FEEDS = [
  { url: 'https://feeds.feedburner.com/zerohedge/feed', name: 'ZeroHedge' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', name: 'CNBC Markets' },
  { url: 'https://www.investing.com/rss/news.rss', name: 'Investing.com' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories', name: 'MarketWatch' },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', name: 'Bloomberg' },
]

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&#x2018;/g, '\u2018').replace(/&#x2019;/g, '\u2019')
    .replace(/&#x2013;/g, '\u2013').replace(/&#x2014;/g, '\u2014')
}

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

    const title = decodeEntities(
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
    ).replace(/<[^>]+>/g, '').trim()

    const link =
      block.match(/<link>(.*?)<\/link>/)?.[1] ??
      block.match(/<guid isPermaLink="true">(.*?)<\/guid>/)?.[1] ?? ''

    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? new Date().toUTCString()

    const rawDesc =
      block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] ??
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
      block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? ''

    const summary = decodeEntities(rawDesc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).slice(0, 600)

    if (!title) continue

    const raw = link || title
    // URL path'ini al, yoksa title'ın son 30 karakterini kullan
    let id: string
    try {
      const url = new URL(raw)
      id = (url.pathname + url.search).replace(/[^a-zA-Z0-9]/g, '').slice(-24)
    } catch {
      id = Buffer.from(raw).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(-24)
    }
    if (!id) id = Math.random().toString(36).slice(2)
    items.push({ id, source, title, link, pubDate, summary: summary || undefined })
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
