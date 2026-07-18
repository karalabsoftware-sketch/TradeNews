import { NextResponse } from 'next/server'
import { getNews } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const news = await getNews()
  console.log('getNews count:', news.length, 'first id:', news[0]?.id)
  return NextResponse.json(news)
}
