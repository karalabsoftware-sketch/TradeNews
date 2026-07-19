import { NextRequest, NextResponse } from 'next/server'
import { getNews } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const piyasa = req.nextUrl.searchParams.get('piyasa') as 'global' | 'bist' | null
  const news = await getNews(piyasa ?? undefined)
  return NextResponse.json(news)
}
