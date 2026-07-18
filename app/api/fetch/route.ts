import { NextRequest, NextResponse } from 'next/server'
import { fetchAllFeeds } from '@/lib/rss'
import { saveNews } from '@/lib/store'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'

  if (!isVercelCron && token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await fetchAllFeeds()
  const saved = await saveNews(items)

  return NextResponse.json({ fetched: items.length, saved })
}
