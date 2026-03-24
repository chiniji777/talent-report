import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import type { Context, Next } from 'hono'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required')

const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin'

const auth = new Hono()

auth.post('/login', async (c) => {
  const body = await c.req.json()
  const { username, password } = body

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' })
    return c.json({ success: true, token })
  }

  return c.json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, 401)
})

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const path = c.req.path

    // Skip auth for login endpoint
    if (path === '/api/auth/login') {
      return next()
    }

    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'กรุณาเข้าสู่ระบบ' }, 401)
    }

    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      c.set('user', decoded)
      return next()
    } catch {
      return c.json({ error: 'Token หมดอายุหรือไม่ถูกต้อง' }, 401)
    }
  }
}

export { auth }
