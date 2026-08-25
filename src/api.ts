const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

type Credentials = { name?: string; email: string; password: string }
type AuthResponse = { token: string; user: { id: string; name: string; email: string; goal: number } }
export type ApiProfile = { id: string; name: string; email: string; goal: number }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to reach SESSION-SCHEDULAR API')
  return payload as T
}

export const register = (credentials: Credentials) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(credentials) })
export const login = (credentials: Credentials) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) })

export type ApiSession = { id: string; subject: string; minutes: number; date: string; mode: string; notes: string }
const authorized = () => ({ Authorization: `Bearer ${localStorage.getItem('studyflow-token') || ''}` })
export const getProfile = () => request<ApiProfile>('/profile', { headers: authorized() })
export const updateProfile = (profile: Pick<ApiProfile, 'name' | 'email' | 'goal'>) => request<ApiProfile>('/profile', { method: 'PUT', headers: authorized(), body: JSON.stringify(profile) })
export const getSessions = () => request<ApiSession[]>('/sessions', { headers: authorized() })
export const createSession = (session: Omit<ApiSession, 'id'>) => request<ApiSession>('/sessions', { method: 'POST', headers: authorized(), body: JSON.stringify(session) })
export const updateSession = (id: number | string, session: Omit<ApiSession, 'id'>) => request<ApiSession>(`/sessions/${id}`, { method: 'PUT', headers: authorized(), body: JSON.stringify(session) })
export const deleteSession = (id: number | string) => request<void>(`/sessions/${id}`, { method: 'DELETE', headers: authorized() })
export type ApiSubject = { id: string; name: string; color: string }
export const getSubjects = () => request<ApiSubject[]>('/subjects', { headers: authorized() })
export const createSubject = (subject: Omit<ApiSubject, 'id'>) => request<ApiSubject>('/subjects', { method: 'POST', headers: authorized(), body: JSON.stringify(subject) })
export const updateSubject = (id: number | string, subject: Omit<ApiSubject, 'id'>) => request<ApiSubject>(`/subjects/${id}`, { method: 'PUT', headers: authorized(), body: JSON.stringify(subject) })
export const deleteSubject = (id: number | string) => request<void>(`/subjects/${id}`, { method: 'DELETE', headers: authorized() })
export const askStudyAgent = (message: string, context: { goal: number; progress: number; sessions: Array<Omit<ApiSession, 'id'> & { id: number | string }> }) => request<{ reply: string }>('/agent/chat', { method: 'POST', headers: authorized(), body: JSON.stringify({ message, context }) })
