import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createUser, deleteUser, listUsers, updateUser, type SessionUser, type UserRole } from '../auth-api'
import { Icon } from '../icons'
import { Brand } from './Brand'

const emptyCreate = { username: '', displayName: '', role: 'user' as UserRole, password: '' }

export function UsersPage({ currentUser }: { currentUser: SessionUser }) {
  const [users, setUsers] = useState<SessionUser[]>([])
  const [draft, setDraft] = useState(emptyCreate)
  const [openId, setOpenId] = useState<number | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [enabled, setEnabled] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Membaca akun lokal…')

  const load = useCallback(async () => {
    try { const result = await listUsers(); setUsers(result.data); setMessage(`${result.pagination.total} akun lokal.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Daftar pengguna tidak dapat dibaca.') }
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true)
    try { await createUser(draft); setDraft(emptyCreate); await load(); setMessage('Akun dibuat. Berikan password sementara melalui kanal yang aman.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Akun tidak dapat dibuat.') }
    finally { setBusy(false) }
  }

  const open = (user: SessionUser) => {
    setOpenId(openId === user.id ? null : user.id); setDisplayName(user.displayName); setRole(user.role); setEnabled(user.enabled); setPassword(''); setConfirmation('')
  }

  const save = async (user: SessionUser) => {
    setBusy(true)
    try { await updateUser(user.id, { displayName, role, enabled, ...(password ? { password } : {}) }); await load(); setPassword(''); setMessage(`Akun @${user.username} diperbarui.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Akun tidak dapat diperbarui.') }
    finally { setBusy(false) }
  }

  const remove = async (user: SessionUser) => {
    setBusy(true)
    try { await deleteUser(user.id, confirmation); setOpenId(null); await load(); setMessage(`Akun @${user.username} dan seluruh pekerjaan miliknya dihapus.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Akun tidak dapat dihapus.') }
    finally { setBusy(false) }
  }

  return <main className="users-shell" data-design-contract="Operate-mode account ledger extending the Cobalt Proof Sheet.">
    <header className="about-command-bar"><Brand href="#workspace" className="about-brand" label="Workspace Transkrip"/><div className="privacy-state"><Icon name="shield"/><span><b>RBAC lokal</b><small>Admin mengelola akun, bukan isi transkrip</small></span></div><div className="about-location"><span>Menu</span><strong>Users</strong></div><a className="about-back" href="#workspace"><Icon name="back"/>Workspace</a></header>
    <section className="users-intro"><div><h1>Kelola akses tanpa mencampur pekerjaan.</h1><p>Setiap akun mempunyai kredensial dan ruang transkripsi sendiri. Menonaktifkan akun mempertahankan pekerjaan; penghapusan akun menghapus seluruh pekerjaan pemilik secara permanen.</p></div><aside><Icon name="shield"/><b>Batas administrator</b><p>Peran admin dapat mengelola akun, tetapi API transkrip tetap dibatasi ke pemilik sesi.</p></aside></section>
    <form className="user-create" onSubmit={create}><h2>Buat akun</h2><label><span>Username</span><input value={draft.username} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,49}" required onChange={event => setDraft(value => ({ ...value, username: event.target.value }))}/></label><label><span>Nama tampilan</span><input value={draft.displayName} maxLength={100} required onChange={event => setDraft(value => ({ ...value, displayName: event.target.value }))}/></label><label><span>Peran</span><select value={draft.role} onChange={event => setDraft(value => ({ ...value, role: event.target.value as UserRole }))}><option value="user">Pengguna</option><option value="admin">Administrator</option></select></label><label><span>Password sementara</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={draft.password} required onChange={event => setDraft(value => ({ ...value, password: event.target.value }))}/></label><button disabled={busy}><Icon name="user"/>Buat akun</button></form>
    <section className="user-ledger" aria-labelledby="user-ledger-title"><header><div><h2 id="user-ledger-title">Daftar akun</h2><p role="status" aria-live="polite">{message}</p></div><button onClick={() => void load()} disabled={busy}><Icon name="refresh"/>Muat ulang</button></header>{users.map(user => <article key={user.id} className={openId === user.id ? 'open' : ''}><button className="user-row" onClick={() => open(user)} aria-expanded={openId === user.id}><span>#{String(user.id).padStart(4, '0')}</span><strong>{user.displayName}<small>@{user.username}</small></strong><span>{user.role === 'admin' ? 'Administrator' : 'Pengguna'}</span><span>{user.enabled ? 'Aktif' : 'Dinonaktifkan'}</span><span>{openId === user.id ? 'Tutup' : 'Kelola'}</span></button>{openId === user.id ? <div className="user-editor"><label><span>Nama tampilan</span><input value={displayName} maxLength={100} onChange={event => setDisplayName(event.target.value)}/></label><label><span>Peran</span><select value={role} onChange={event => setRole(event.target.value as UserRole)}><option value="user">Pengguna</option><option value="admin">Administrator</option></select></label><label className="user-enabled"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)}/><span>Akun aktif</span></label><label><span>Password baru (opsional)</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/></label><button onClick={() => void save(user)} disabled={busy}><Icon name="check"/>Simpan akun</button><div className="user-danger"><p><b>Hapus permanen</b><span>Ketik <code>{user.username}</code> untuk menghapus akun dan seluruh pekerjaannya.</span></p><input aria-label={`Konfirmasi hapus ${user.username}`} value={confirmation} onChange={event => setConfirmation(event.target.value)}/><button onClick={() => void remove(user)} disabled={busy || user.id === currentUser.id || confirmation !== user.username}><Icon name="trash"/>Hapus akun</button></div></div> : null}</article>)}</section>
  </main>
}
