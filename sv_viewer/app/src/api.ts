import type { SemanticViewSummary, SemanticViewDetail } from './types'

const BASE = '/api'

export async function fetchViews(): Promise<SemanticViewSummary[]> {
  const res = await fetch(`${BASE}/views`)
  if (!res.ok) throw new Error(`Failed to fetch views: ${res.statusText}`)
  return res.json()
}

export async function fetchViewDetail(database: string, schema: string, name: string): Promise<SemanticViewDetail> {
  const res = await fetch(`${BASE}/views/${encodeURIComponent(database)}/${encodeURIComponent(schema)}/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Failed to fetch view detail: ${res.statusText}`)
  return res.json()
}
