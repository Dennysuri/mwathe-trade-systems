import { timingSafeEqual } from 'node:crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const expected = process.env.AUTOD_AI_PASSWORD
  if (!expected) return res.status(503).json({ error: 'AutoD AI authentication is not configured on the server.' })

  const supplied = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!supplied || supplied.length > 256) return res.status(400).json({ error: 'A valid password is required.' })

  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  const valid = expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)

  if (!valid) return res.status(401).json({ error: 'Invalid password.' })
  return res.status(200).json({ authenticated: true })
}
