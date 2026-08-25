import cors from 'cors'
import express, { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 4000)
const secret = process.env.JWT_SECRET || 'session-schedular-development-secret'
const database = new DatabaseSync(join(dirname(fileURLToPath(import.meta.url)), 'session-schedular.sqlite'))

database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    goal INTEGER NOT NULL DEFAULT 180,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    minutes INTEGER NOT NULL CHECK (minutes > 0),
    date TEXT NOT NULL,
    mode TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, date);
  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#456990',
    UNIQUE(user_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
`)

declare global { namespace Express { interface Request { userId?: string } } }
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const publicUser = (user: any) => ({ id: user.id, name: user.name, email: user.email, goal: user.goal })
const issueToken = (userId: string) => jwt.sign({ userId }, secret, { expiresIn: '7d' })
const auth = (request: Request, response: Response, next: NextFunction) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) return response.status(401).json({ error: 'Authentication required' })
  try { request.userId = (jwt.verify(token, secret) as { userId: string }).userId; next() }
  catch { response.status(401).json({ error: 'Invalid or expired session' }) }
}
const validateSession = (body: any) => !body?.subject?.trim() || !Number.isFinite(body.minutes) || body.minutes <= 0 || !body.date || !body.mode
const sessionResponse = (row: any) => ({ id: row.id, subject: row.subject, minutes: row.minutes, date: row.date, mode: row.mode, notes: row.notes })
const agentBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'
const agentModel = process.env.AI_MODEL || 'gpt-4o-mini'

app.post('/api/auth/register', async (request, response) => {
  const { name, email, password } = request.body as Record<string, string>
  if (!name?.trim() || !email?.trim() || !password || password.length < 8) return response.status(400).json({ error: 'Name, email, and an 8-character password are required' })
  const normalizedEmail = email.trim().toLowerCase()
  try {
    const user = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), goal: 180 }
    database.prepare('INSERT INTO users (id, name, email, password_hash, goal) VALUES (?, ?, ?, ?, ?)').run(user.id, user.name, user.email, user.passwordHash, user.goal)
    response.status(201).json({ token: issueToken(user.id), user: publicUser(user) })
  } catch { response.status(409).json({ error: 'An account with that email already exists' }) }
})

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body as Record<string, string>
  const user = database.prepare('SELECT id, name, email, password_hash AS passwordHash, goal FROM users WHERE email = ?').get(email?.trim().toLowerCase()) as any
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return response.status(401).json({ error: 'Invalid email or password' })
  response.json({ token: issueToken(user.id), user: publicUser(user) })
})

app.get('/api/profile', auth, (request, response) => {
  const user = database.prepare('SELECT id, name, email, goal FROM users WHERE id = ?').get(request.userId) as any
  if (!user) return response.status(404).json({ error: 'User not found' })
  response.json(user)
})
app.put('/api/profile', auth, (request, response) => {
  const name = String(request.body?.name || '').trim()
  const email = String(request.body?.email || '').trim().toLowerCase()
  const goal = Number(request.body?.goal)
  if (!name || !email || !Number.isInteger(goal) || goal < 15) return response.status(400).json({ error: 'Name, email, and a goal of at least 15 minutes are required' })
  try {
    const result = database.prepare('UPDATE users SET name = ?, email = ?, goal = ? WHERE id = ?').run(name, email, goal, request.userId)
    if (!result.changes) return response.status(404).json({ error: 'User not found' })
    response.json({ id: request.userId, name, email, goal })
  } catch { response.status(409).json({ error: 'That email address is already in use' }) }
})

app.get('/api/sessions', auth, (_request, response) => {
  const rows = database.prepare('SELECT id, subject, minutes, date, mode, notes FROM study_sessions WHERE user_id = ? ORDER BY date DESC, created_at DESC').all(_request.userId)
  response.json(rows.map(sessionResponse))
})

app.post('/api/sessions', auth, (request, response) => {
  if (validateSession(request.body)) return response.status(400).json({ error: 'Subject, positive duration, date, and mode are required' })
  const session = { id: crypto.randomUUID(), userId: request.userId, subject: request.body.subject.trim(), minutes: request.body.minutes, date: request.body.date, mode: request.body.mode, notes: request.body.notes || '' }
  database.prepare('INSERT INTO study_sessions (id, user_id, subject, minutes, date, mode, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(session.id, session.userId, session.subject, session.minutes, session.date, session.mode, session.notes)
  response.status(201).json(session)
})

app.put('/api/sessions/:id', auth, (request, response) => {
  if (validateSession(request.body)) return response.status(400).json({ error: 'Subject, positive duration, date, and mode are required' })
  const result = database.prepare('UPDATE study_sessions SET subject = ?, minutes = ?, date = ?, mode = ?, notes = ? WHERE id = ? AND user_id = ?').run(request.body.subject.trim(), request.body.minutes, request.body.date, request.body.mode, request.body.notes || '', request.params.id, request.userId)
  if (!result.changes) return response.status(404).json({ error: 'Session not found' })
  response.json({ id: request.params.id, subject: request.body.subject.trim(), minutes: request.body.minutes, date: request.body.date, mode: request.body.mode, notes: request.body.notes || '' })
})

app.delete('/api/sessions/:id', auth, (request, response) => {
  database.prepare('DELETE FROM study_sessions WHERE id = ? AND user_id = ?').run(request.params.id, request.userId)
  response.status(204).end()
})
app.post('/api/agent/chat', auth, async (request, response) => {
  const message = String(request.body?.message || '').trim()
  if (!message) return response.status(400).json({ error: 'A message is required' })
  if (!process.env.AI_API_KEY) return response.status(503).json({ error: 'AI_API_KEY is not configured; local study guidance is available' })
  const context = request.body?.context || {}
  try {
    const upstream = await fetch(`${agentBaseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` }, body: JSON.stringify({ model: agentModel, temperature: 0.4, messages: [{ role: 'system', content: 'You are a supportive college study planning assistant. Give practical, concise advice. Do not make medical claims or encourage unhealthy overwork. Use the supplied study context when helpful.' }, { role: 'user', content: `${message}\n\nStudy context: ${JSON.stringify(context)}` }] }) })
    const payload = await upstream.json() as any
    if (!upstream.ok) return response.status(502).json({ error: payload.error?.message || 'AI provider request failed' })
    response.json({ reply: payload.choices?.[0]?.message?.content || 'I could not form a response right now.' })
  } catch { response.status(502).json({ error: 'AI provider is unavailable' }) }
})

app.get('/api/subjects', auth, (request, response) => {
  response.json(database.prepare('SELECT id, name, color FROM subjects WHERE user_id = ? ORDER BY name').all(request.userId))
})
app.post('/api/subjects', auth, (request, response) => {
  const name = String(request.body?.name || '').trim()
  const color = String(request.body?.color || '#456990')
  if (!name) return response.status(400).json({ error: 'Subject name is required' })
  const id = crypto.randomUUID()
  try { database.prepare('INSERT INTO subjects (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(id, request.userId, name, color); response.status(201).json({ id, name, color }) }
  catch { response.status(409).json({ error: 'That subject already exists' }) }
})
app.put('/api/subjects/:id', auth, (request, response) => {
  const name = String(request.body?.name || '').trim()
  const color = String(request.body?.color || '#456990')
  if (!name) return response.status(400).json({ error: 'Subject name is required' })
  try { const result = database.prepare('UPDATE subjects SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(name, color, request.params.id, request.userId); if (!result.changes) return response.status(404).json({ error: 'Subject not found' }); response.json({ id: request.params.id, name, color }) }
  catch { response.status(409).json({ error: 'That subject already exists' }) }
})
app.delete('/api/subjects/:id', auth, (request, response) => { database.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?').run(request.params.id, request.userId); response.status(204).end() })

app.use((_error: Error, _request: Request, response: Response, _next: NextFunction) => response.status(500).json({ error: 'Unexpected server error' }))
app.listen(port, () => console.log(`SESSION-SCHEDULAR SQLite API listening on http://localhost:${port}`))
