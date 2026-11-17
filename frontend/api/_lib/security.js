import { createHash } from 'node:crypto'

const DEFAULT_ORIGINS = ['https://mwathe-trade-systems-gamma.vercel.app']

export function setPrivateResponseHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

export function isAllowedOrigin(req) {
  const origin = req.headers.origin
  if (typeof origin !== 'string') return false

  let normalized
  try {
    const parsed = new URL(origin)
    if (parsed.origin !== origin || !['https:', ...(process.env.NODE_ENV !== 'production' ? ['http:'] : [])].includes(parsed.protocol)) return false
    normalized = parsed.origin
  } catch {
    return false
  }

  const configured = (process.env.APP_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  const allowed = new Set([...DEFAULT_ORIGINS, ...configured])

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:5173')
    allowed.add('http://127.0.0.1:5173')
  }

  return allowed.has(normalized)
}

function getClientAddress(req) {
  const address = req.headers['x-real-ip']
  if (typeof address === 'string' && address.length <= 64) return address
  return ''
}

// Shared, atomic fixed-window counter. Requires Upstash Redis REST so limits
// work across all Vercel serverless instances instead of resetting per instance.
export async function enforceRateLimit(req, res, { key, limit, windowSeconds }) {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const address = getClientAddress(req)

  if (!baseUrl || !token || !address) {
    res.status(503).json({ error: 'Security rate limiting is not configured. Please try again later.' })
    return false
  }

  const addressHash = createHash('sha256').update(address).digest('hex')
  const redisKey = `mwathe:ratelimit:${key}:${addressHash}`

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, windowSeconds, 'NX'],
      ]),
      signal: AbortSignal.timeout(4000),
    })

    if (!response.ok) throw new Error('Rate-limit store unavailable')
    const results = await response.json()
    const count = Number(results?.[0]?.result)
    if (!Number.isFinite(count)) throw new Error('Invalid rate-limit response')

    res.setHeader('RateLimit-Limit', String(limit))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - count)))

    if (count > limit) {
      res.setHeader('Retry-After', String(windowSeconds))
      res.status(429).json({ error: 'Too many requests. Please wait before trying again.' })
      return false
    }

    return true
  } catch {
    res.status(503).json({ error: 'Security rate limiting is temporarily unavailable. Please try again later.' })
    return false
  }
}
