import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. Nitter RSS test
  try {
    const res = await fetch('https://nitter.poast.org/FirstSquawk/rss', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    results.nitter_status = res.status
    results.nitter_ok = res.ok
    results.nitter_preview = text.slice(0, 500)
  } catch (e) {
    results.nitter_error = String(e)
  }

  // 2. KV test
  try {
    const BASE = process.env.KV_REST_API_URL
    const TOKEN = process.env.KV_REST_API_TOKEN
    results.kv_url_set = !!BASE
    results.kv_token_set = !!TOKEN

    if (BASE && TOKEN) {
      const res = await fetch(`${BASE}/get/news:items`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
      const json = await res.json()
      results.kv_status = res.status
      results.kv_has_data = !!json.result
    }
  } catch (e) {
    results.kv_error = String(e)
  }

  return NextResponse.json(results, { status: 200 })
}
