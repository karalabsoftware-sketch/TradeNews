export interface NewsItem {
  id: string
  source: string
  title: string
  link: string
  pubDate: string
  analysis?: string
}

// RSSHub public instances - Twitter/X user timeline feed
const RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://hub.slarker.me',
]

const ACCOUNTS = [
  { handle: 'FirstSquawk', name: 'First Squawk' },
  { handle: 'zerohedge', name: 'ZeroHedge' },
  { handle: 'unusual_whales', name: 'Unusual Whales' },
  { handle: 'WalterBloomberg', name: 'Walter Bloomberg' },
  { handle: 'spectatorindex', name: 'The Spectator Index' },
]

async function fetchRSS(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const text = await res.text()
    // RSSHub bazen HTML hata sayfası döner, XML kontrolü yap
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
      block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s)?.[1] ??
      block.match(/<title>(.*?)<\/title>/s)?.[1] ??
      ''
    const link =
      block.match(/<link>(.*?)<\/link>/)?.[1] ??
      block.match(/<guid>(.*?)<\/guid>/)?.[1] ??
      ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? new Date().toUTCString()

    const cleaned = title.replace(/<[^>]+>/g, '').trim()
    if (!cleaned || cleaned.startsWith('RT @')) continue

    const id = Buffer.from(link || cleaned).toString('base64').slice(0, 16)
    items.push({ id, source, title: cleaned, link, pubDate })
  }

  return items.slice(0, 10)
}

async function fetchAccountFeed(handle: string): Promise<NewsItem[]> {
  for (const instance of RSSHUB_INSTANCES) {
    // RSSHub Twitter endpoint: /twitter/user/:id
    const xml = await fetchRSS(`${instance}/twitter/user/${handle}`)
    if (xml) {
      console.log(`Fetched ${handle} from ${instance}`)
      return parseRSSItems(xml, handle)
    }
  }
  console.warn(`Could not fetch ${handle} from any RSSHub instance`)
  return []
}

export async function fetchAllFeeds(): Promise<NewsItem[]> {
  const fetches = ACCOUNTS.map((account) =>
    fetchAccountFeed(account.handle).then((items) =>
      items.map((item) => ({ ...item, source: account.name }))
    )
  )

  const settled = await Promise.allSettled(fetches)
  const results: NewsItem[] = []

  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value)
  }

  return results.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  )
}
