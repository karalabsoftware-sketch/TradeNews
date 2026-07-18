import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. RSSHub test
  try {
    const res = await fetch('https://rsshub.app/twitter/user/FirstSquawk', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    results.rsshub_status = res.status
    results.rsshub_ok = res.ok
    results.rsshub_has_items = text.includes('<item>')
    results.rsshub_preview = text.slice(0, 300)
  } catch (e) {
    results.rsshub_error = String(e)
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

  return NextResponse.json(results)
}
