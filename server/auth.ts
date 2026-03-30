import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import type { Context, Next } from 'hono'
import { Database } from 'bun:sqlite'
import path from 'path'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required')

const dbPath = path.resolve(process.cwd(), 'data/talent.db')
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

const auth = new Hono()

// Login
auth.post('/login', async (c) => {
  const body = await c.req.json()
  const { username, password } = body

  const user = db.query('SELECT * FROM users WHERE username = ?').get(username) as any
  if (!user) return c.json({ success: false, error: 'Username or password incorrect' }, 401)

  const valid = await Bun.password.verify(password, user.password)
  if (!valid) return c.json({ success: false, error: 'Username or password incorrect' }, 401)

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, displayName: user.display_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
  return c.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, displayName: user.display_name } })
})

// Change own password (any user)
auth.post('/change-password', async (c) => {
  const decoded = c.get('user') as any
  if (!decoded) return c.json({ error: 'Unauthorized' }, 401)

  const { current_password, new_password } = await c.req.json()
  if (!new_password || new_password.length < 4) {
    return c.json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' }, 400)
  }

  const user = db.query('SELECT * FROM users WHERE id = ?').get(decoded.userId) as any
  if (!user) return c.json({ error: 'User not found' }, 404)

  const valid = await Bun.password.verify(current_password, user.password)
  if (!valid) return c.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, 400)

  const hashed = await Bun.password.hash(new_password)
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, decoded.userId)

  return c.json({ success: true })
})

// List users (admin only)
auth.get('/users', (c) => {
  const decoded = c.get('user') as any
  if (!decoded || decoded.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const users = db.query('SELECT id, username, display_name, role, created_at FROM users ORDER BY id').all()
  return c.json({ users })
})

// Create staff user (admin only)
auth.post('/users', async (c) => {
  const decoded = c.get('user') as any
  if (!decoded || decoded.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const { username, password, display_name } = await c.req.json()
  if (!username || !password) return c.json({ error: 'Username and password required' }, 400)
  if (password.length < 4) return c.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' }, 400)

  // Check duplicate
  const existing = db.query('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return c.json({ error: 'Username นี้มีอยู่แล้ว' }, 400)

  const hashed = await Bun.password.hash(password)
  const info = db.prepare('INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run(
    username, hashed, display_name || username, 'staff'
  )

  return c.json({ success: true, id: Number(info.lastInsertRowid) })
})

// Delete staff user (admin only, can't delete admin)
auth.delete('/users/:id', (c) => {
  const decoded = c.get('user') as any
  if (!decoded || decoded.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const id = parseInt(c.req.param('id'), 10)
  const target = db.query('SELECT * FROM users WHERE id = ?').get(id) as any
  if (!target) return c.json({ error: 'User not found' }, 404)
  if (target.role === 'admin') return c.json({ error: 'ไม่สามารถลบ admin ได้' }, 400)

  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return c.json({ success: true })
})

// Reset staff password (admin only)
auth.post('/users/:id/reset-password', async (c) => {
  const decoded = c.get('user') as any
  if (!decoded || decoded.role !== 'admin') return c.json({ error: 'Admin only' }, 403)

  const id = parseInt(c.req.param('id'), 10)
  const { new_password } = await c.req.json()
  if (!new_password || new_password.length < 4) return c.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' }, 400)

  const target = db.query('SELECT * FROM users WHERE id = ?').get(id) as any
  if (!target) return c.json({ error: 'User not found' }, 404)

  const hashed = await Bun.password.hash(new_password)
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, id)

  return c.json({ success: true })
})

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const reqPath = c.req.path
    if (reqPath === '/api/auth/login') return next()

    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Please login' }, 401)
    }

    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any
      c.set('user', decoded)

      const role = decoded.role
      if (role === 'admin') return next()

      // Staff allowed paths
      const staffAllowed = ['/api/auth/', '/api/import', '/api/invoices']
      const isAllowed = staffAllowed.some(p => reqPath.startsWith(p))
      if (!isAllowed) {
        return c.json({ error: 'Access denied' }, 403)
      }

      return next()
    } catch {
      return c.json({ error: 'Token expired or invalid' }, 401)
    }
  }
}

export { auth }
