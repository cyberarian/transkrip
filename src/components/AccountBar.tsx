import type { SessionUser } from '../auth-api'
import { Icon } from '../icons'
import { OllamaStatus } from './OllamaStatus'

export function AccountBar({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  return <aside className="account-session-bar" aria-label="Sesi pengguna">
    <span><Icon name="user"/><b>{user.displayName}</b><small>@{user.username} · {user.role === 'admin' ? 'Administrator' : 'Pengguna'}</small></span>
    <OllamaStatus/>
    {user.role === 'admin' ? <a href="#users"><Icon name="settings"/>Users</a> : null}
    <button onClick={onLogout}><Icon name="logout"/>Log out</button>
  </aside>
}
