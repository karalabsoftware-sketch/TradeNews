export interface NewsItem {
  id: string
  source: string
  title: string
  link: string
  pubDate: string
  analysis?: string
}

// Güncel instance listesi: https://github.com/zedeus/nitter/wiki/Instances
const ALL_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.catsarch.com',
  'https://nitter.unixfox.eu',
  'https://nitter.moomoo.me',
  'https://nitter.1d4.us',
  'https://nitter.kavin.rocks',
  'https://nitter.sethforprivacy.com',
  'https://nitter.tiekoetter.com',
]

const ACCOUNTS = [
  { handle: 'FirstSquawk', name: 'First Squawk' },
  { handle: 'zerohedge', name: 'ZeroHedge' },
  { handle: 'unusual_whales', name: 'Unusual Whales' },
  { handle: 'WalterBloomberg', name: 'Walter Bloomberg' },
  { handle: 'spectatorindex', name: 'The Spectator Index' },
]

// Session boyunca çalışan instance'ları cache'le
let workingInstances: string[] | null = null

async function probeInstance(instance: string): Promise<string | null> {
  try {
    const res = await fetch(`${instance}/FirstSquawk/rss`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return instance
    return null
  } catch {
    return null
  }
}

async function getWorkingInstances(): Promise<string[]> {
  if (workingInstances && workingInstances.length > 0) return workingInstances

  // Tüm instance'ları paralel test et
  const results = await Promise.allSettled(ALL_INSTANCES.map(probeInstance))

  workingInstances = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((v): v is string => v !== null)

  if (workingInstances.length === 0) {
    // Hiçbiri cevap vermediyse hepsini dene (fallback)
    workingInstances = ALL_INSTANCES
  }

  console.log(`Working nitter instances: ${workingInstances.length}/${ALL_INSTANCES.length}`)
  return workingInstances
}

async function fetchRSS(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function fetchAccountFeed(handle: string, instances: string[]): Promise<string | null> {
  for (const instance of instances) {
    const xml = await fetchRSS(`${instance}/${handle}/rss`)
    if (xml) return xml

    // Bu instance başarısız, session cache'den çıkar
    if (workingInstances) {
      workingInstances = workingInstances.filter((i) => i !== instance)
    }
  }
  return null
}

function parseRSSItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const block = match[1]
    const title =
      block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      block.match(/<title>(.*?)<\/title>/)?.[1] ??
      ''
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? ''
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''

    if (!title || title.startsWith('RT @')) continue

    const id = Buffer.from(link || title).toString('base64').slice(0, 16)
    items.push({ id, source, title: title.trim(), link, pubDate })
  }

  return items.slice(0, 10)
}

export async function fetchAllFeeds(): Promise<NewsItem[]> {
  const instances = await getWorkingInstances()
  const results: NewsItem[] = []

  // Tüm hesapları paralel çek
  const fetches = ACCOUNTS.map(async (account) => {
    const xml = await fetchAccountFeed(account.handle, instances)
    if (!xml) {
      console.warn(`Could not fetch ${account.handle} from any instance`)
      return []
    }
    return parseRSSItems(xml, account.name)
  })

  const settled = await Promise.allSettled(fetches)
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value)
  }

  return results.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  )
}
