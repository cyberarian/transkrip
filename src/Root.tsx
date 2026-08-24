import { useEffect, useState } from 'react'
import App from './App'
import { AboutPage } from './components/AboutPage'
import { LandingPage } from './components/LandingPage'
import { SettingsPage } from './components/SettingsPage'
import { TasksPage } from './components/TasksPage'
import { routeFromHash } from './routes'
import { retainWorkspace } from './workspace-lifecycle'
import { AuthApiError, getSession, logout, type SessionUser } from './auth-api'
import { LoginPage } from './components/LoginPage'
import { AccountBar } from './components/AccountBar'
import { UsersPage } from './components/UsersPage'
import { AnalysisPage } from './components/AnalysisPage'

export function Root() {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash))
  const [workspaceOpened, setWorkspaceOpened] = useState(() => route === 'workspace')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMessage, setAuthMessage] = useState<string>()

  useEffect(() => {
    let active = true
    getSession().then(result => { if (active) setUser(result.user) }).catch(error => { if (active && !(error instanceof AuthApiError && error.status === 401)) setAuthMessage(error instanceof Error ? error.message : 'Sesi lokal tidak dapat dibaca.') }).finally(() => { if (active) setAuthReady(true) })
    const unauthenticated = () => { setUser(null); setAuthReady(true); setAuthMessage('Sesi berakhir. Silakan masuk kembali.') }
    window.addEventListener('transkrip:unauthenticated', unauthenticated)
    return () => { active = false; window.removeEventListener('transkrip:unauthenticated', unauthenticated) }
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      const next = routeFromHash(window.location.hash)
      if (next === 'workspace') setWorkspaceOpened(true)
      setRoute(next)
    }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  if (!authReady) return <main className="auth-loading" aria-busy="true"><span/><strong>Memverifikasi sesi lokal…</strong></main>
  if (!user) return <LoginPage initialMessage={authMessage} onAuthenticated={authenticated => { setUser(authenticated); setAuthMessage(undefined); window.location.hash = '#workspace' }}/>

  const endSession = async () => { try { await logout() } finally { setUser(null); setWorkspaceOpened(false); window.location.hash = '' } }
  const safeRoute = route === 'users' && user.role !== 'admin' ? 'landing' : route
  const keepWorkspace = retainWorkspace(workspaceOpened, safeRoute)
  return <>
    <AccountBar user={user} onLogout={() => void endSession()}/>
    {keepWorkspace ? <div className="route-surface authenticated-surface" hidden={safeRoute !== 'workspace'}><App routeActive={safeRoute === 'workspace'} diarizationMode={user.diarizationMode}/></div> : null}
    <div className="authenticated-surface" hidden={safeRoute === 'workspace'}>
      {safeRoute === 'about' ? <AboutPage/> : null}
      {safeRoute === 'settings' ? <SettingsPage user={user} onUserUpdated={setUser}/> : null}
      {safeRoute === 'tasks' ? <TasksPage/> : null}
      {safeRoute === 'analysis' ? <AnalysisPage/> : null}
      {safeRoute === 'users' ? <UsersPage currentUser={user}/> : null}
      {safeRoute === 'landing' ? <LandingPage/> : null}
    </div>
  </>
}
