import { Brand } from './Brand'
import { Icon } from '../icons'
import type { AppRoute } from '../routes'

const destinations = [
  { route: 'workspace', label: 'Workspace', icon: 'edit' },
  { route: 'tasks', label: 'Tasks', icon: 'folder' },
  { route: 'analysis', label: 'Analysis', icon: 'analysis' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
  { route: 'about', label: 'About', icon: 'info' },
] as const

export function StudioNav({ route }: { route: AppRoute }) {
  return <aside className="studio-nav">
    <Brand href="#" label="Beranda Transkrip"/>
    <a className="studio-create" href="#workspace"><Icon name="upload"/>Buka ruang kerja</a>
    <nav aria-label="Navigasi studio">{destinations.map(item => <a key={item.route} href={`#${item.route}`} aria-current={route === item.route ? 'page' : undefined}><Icon name={item.icon}/><span>{item.label}</span>{item.route === 'analysis' && <small>AI</small>}</a>)}</nav>
    <div className="studio-local"><Icon name="shield"/><strong>Privat. Di perangkat Anda.</strong><p>Ruang untuk percakapan yang berarti. Audio tetap lokal.</p><span>Bahasa Indonesia / English</span></div>
  </aside>
}
