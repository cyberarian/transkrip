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
import { StudioNav } from './components/StudioNav'
import { AnalysisPage } from './components/AnalysisPage'

export function Root() {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash))
  const [tasksOpened, setTasksOpened] = useState(() => route === 'tasks')
  const [workspaceOpened, setWorkspaceOpened] = useState(() => route === 'workspace')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [sessionLocked, setSessionLocked] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authMessage, setAuthMessage] = useState<string>()

  useEffect(() => {
    let active = true
    getSession().then(result => { if (active) setUser(result.user) }).catch(error => { if (active && !(error instanceof AuthApiError && error.status === 401)) setAuthMessage(error instanceof Error ? error.message : 'Sesi lokal tidak dapat dibaca.') }).finally(() => { if (active) setAuthReady(true) })
    const unauthenticated = () => { setSessionLocked(true); setAuthReady(true); setAuthMessage('Sesi berakhir. Silakan masuk kembali.') }
    window.addEventListener('transkrip:unauthenticated', unauthenticated)
    return () => { active = false; window.removeEventListener('transkrip:unauthenticated', unauthenticated) }
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      const next = routeFromHash(window.location.hash)
      if (next === 'tasks') setTasksOpened(true)
      if (next === 'workspace') setWorkspaceOpened(true)
      setRoute(next)
    }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  if (!authReady) return <main className="auth-loading" aria-busy="true"><span/><strong>Memverifikasi sesi lokal…</strong></main>
  if (!user) return <LoginPage initialMessage={authMessage} onAuthenticated={authenticated => { setUser(authenticated); setSessionLocked(false); setAuthMessage(undefined); window.location.hash = '#workspace' }}/>

  const authenticated = (next: SessionUser) => {
    setUser(next); setSessionLocked(false); setAuthMessage(undefined)
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('transkrip:authenticated', { detail: next.id })), 0)
  }

  const endSession = async () => {
    const pending: Promise<void>[] = []
    window.dispatchEvent(new CustomEvent('transkrip:flush', { detail: pending }))
    try { await Promise.all(pending) } catch { return }
    try { await logout() } finally { setUser(null); setWorkspaceOpened(false); setTasksOpened(false); window.location.hash = '' }
  }
  const safeRoute = route === 'users' && user.role !== 'admin' ? 'landing' : route
  const keepWorkspace = retainWorkspace(workspaceOpened, safeRoute)
  return <>
    {sessionLocked && <LoginPage initialMessage={authMessage} onAuthenticated={authenticated}/>}
    <div className="studio-shell" hidden={sessionLocked} key={user.id}>
    <StudioNav route={safeRoute}/>
    <div className="studio-main">
    <AccountBar user={user} onLogout={() => void endSession()}/>
    {keepWorkspace ? <div className="route-surface authenticated-surface" hidden={safeRoute !== 'workspace'}><App ownerId={user.id} routeActive={!sessionLocked && safeRoute === 'workspace'} diarizationMode={user.diarizationMode}/></div> : null}
    <div className="authenticated-surface" hidden={safeRoute === 'workspace'}>
      {safeRoute === 'about' ? <AboutPage/> : null}
      {safeRoute === 'settings' ? <SettingsPage user={user} onUserUpdated={setUser}/> : null}
      {tasksOpened && <div hidden={safeRoute !== 'tasks'}><TasksPage ownerId={user.id}/></div>}
      {safeRoute === 'analysis' ? <AnalysisPage/> : null}
      {safeRoute === 'users' ? <UsersPage currentUser={user}/> : null}
      {safeRoute === 'landing' ? <LandingPage/> : null}
    </div>
    </div>
  </div>
  </>
}
