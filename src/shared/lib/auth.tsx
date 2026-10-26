import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEMO_USERS } from './config'
import { logActivity } from './repo'
import { getSupabase, isConfigured } from './supabase'
import type { Role, SessionUser, Staff } from './types'

interface AuthCtx {
  mode: 'demo' | 'live'
  user: SessionUser | null
  loading: boolean
  /** signed in, but no active staff row yet (needs the owner's approval) */
  pending: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
  demoSignIn: (role: Role) => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

const DEMO_KEY = 'shi:demo-role'

async function loadStaff(id: string): Promise<Staff | null> {
  const { data } = await getSupabase().from('re_staff').select('*').eq('id', id).maybeSingle()
  return (data as Staff) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = isConfigured ? 'live' : 'demo'
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback(async (sessionUser: { id: string; email?: string } | null) => {
    if (!sessionUser) {
      setUser(null)
      return
    }
    let staff = await loadStaff(sessionUser.id)
    if (!staff) {
      // account created before the tables, or in the Supabase dashboard: join the team
      const { data } = await getSupabase().rpc('re_join')
      staff = (data as Staff | null) ?? null
    }
    setUser({
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      name: staff?.full_name || sessionUser.email || 'مستخدم',
      role: staff?.role ?? 'secretary',
      active: Boolean(staff?.active),
      title: staff?.title ?? null,
      permissions: staff?.permissions ?? ['properties'], // same default as the database column
    })
  }, [])

  useEffect(() => {
    if (mode === 'demo') {
      try {
        const role = sessionStorage.getItem(DEMO_KEY) as Role | null
        if (role && DEMO_USERS[role]) setUser(DEMO_USERS[role])
      } catch {
        /* ignore */
      }
      setLoading(false)
      return
    }
    const sb = getSupabase()
    sb.auth
      .getSession()
      .then(({ data }) => applySession(data.session?.user ?? null))
      .finally(() => setLoading(false))
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      void applySession(session?.user ?? null)
    })
    // permissions changed by the owner apply when the member comes back to the tab
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void sb.auth.getSession().then(({ data }) => (data.session ? applySession(data.session.user) : undefined))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [mode, applySession])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (mode === 'demo') return 'demo'
      const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
      if (error) return error.message
      await applySession(data.user)
      void logActivity({ id: data.user.id, email: data.user.email ?? '', name: data.user.email ?? '', role: 'secretary', active: true, permissions: [] }, 'login', 'session', null)
      return null
    },
    [mode, applySession],
  )

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      if (mode === 'demo') return 'demo'
      const { error } = await getSupabase().auth.signUp({ email: email.trim(), password, options: { data: { full_name: name, app: 'sweet-house-immo' }, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}admin` } })
      return error ? error.message : null
    },
    [mode],
  )

  const resetPassword = useCallback(
    async (email: string) => {
      if (mode === 'demo') return 'demo'
      const redirectTo = `${location.origin}${import.meta.env.BASE_URL}admin/reset`
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo })
      return error ? error.message : null
    },
    [mode],
  )

  const signOut = useCallback(async () => {
    if (mode === 'demo') {
      sessionStorage.removeItem(DEMO_KEY)
      setUser(null)
      return
    }
    await getSupabase().auth.signOut()
    setUser(null)
  }, [mode])

  const demoSignIn = useCallback((role: Role) => {
    sessionStorage.setItem(DEMO_KEY, role)
    setUser(DEMO_USERS[role])
  }, [])

  const refresh = useCallback(async () => {
    if (mode === 'demo') return
    const { data } = await getSupabase().auth.getSession()
    await applySession(data.session?.user ?? null)
  }, [mode, applySession])

  const value = useMemo<AuthCtx>(
    () => ({ mode, user, loading, pending: Boolean(user && !user.active), signIn, signUp, resetPassword, signOut, demoSignIn, refresh }),
    [mode, user, loading, signIn, signUp, resetPassword, signOut, demoSignIn, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside provider')
  return c
}
