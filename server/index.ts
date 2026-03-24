import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import path from 'path'
import { initDb } from './db'
import { runBackup } from './backup'
import { auth, authMiddleware } from './auth'
import { importRoutes } from './routes/import'
import { invoiceRoutes } from './routes/invoices'
import { reportRoutes } from './routes/reports'
import { costRoutes } from './routes/costs'
import { dbRoutes } from './routes/db'

const app = new Hono()

// Data directory
const dataPath = path.resolve(process.env.DATA_DIR || './data')

// Init database
initDb(dataPath)

// Auto backup on startup
runBackup(dataPath)

// CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Rate limiting (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

app.use('/api/*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const now = Date.now()
  const windowMs = 60_000 // 1 minute
  const maxRequests = 100

  let entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    rateLimitMap.set(ip, entry)
  }

  entry.count++
  if (entry.count > maxRequests) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  return next()
})

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip)
    }
  }
}, 60_000)

// Auth middleware
app.use('/api/*', authMiddleware())

// Error handling
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// Mount routes
app.route('/api/auth', auth)
app.route('/api/import', importRoutes)
app.route('/api/invoices', invoiceRoutes)
app.get('/api/salespersons', (c) => {
  const db = require('./db').getDb()
  const rows = db.prepare(`
    SELECT s.id, s.name, s.nickname,
      COUNT(CASE WHEN i.is_cancelled = 0 THEN 1 END) as invoice_count,
      COUNT(CASE WHEN i.invoice_type = 'IV' AND i.is_cancelled = 0 THEN 1 END) as iv_count,
      COUNT(CASE WHEN i.invoice_type = 'IS' AND i.is_cancelled = 0 THEN 1 END) as is_count,
      COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.subtotal ELSE 0 END), 0) as subtotal,
      COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.vat ELSE 0 END), 0) as vat,
      COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as total
    FROM salesperson s
    LEFT JOIN import_batch ib ON ib.salesperson_id = s.id
    LEFT JOIN invoice i ON i.batch_id = ib.id
    GROUP BY s.id
    ORDER BY total DESC
  `).all()
  return c.json(rows)
})
app.route('/api/reports', reportRoutes)
app.route('/api/costs', costRoutes)
app.route('/api/db', dbRoutes)
app.route('/api/batches', new Hono().delete('/:id', (c) => {
  const { getDb } = require('./db')
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) {
    return c.json({ success: false, error: 'Invalid batch ID' }, 400)
  }
  const db = getDb()
  db.prepare('DELETE FROM import_batch WHERE id = ?').run(id)
  return c.json({ success: true })
}))

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './client/dist' }))
  app.get('*', serveStatic({ path: './client/dist/index.html' }))
}

// Version endpoint
app.get('/api/version', (c) => {
  return c.json({ version: '1.0.0', name: 'Talent Report API' })
})

const port = parseInt(process.env.PORT || '4010', 10)

console.log(`🐙 Talent Report API running on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
