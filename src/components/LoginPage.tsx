import { useState, type FormEvent } from 'react'
import { login, type SessionUser } from '../auth-api'
import { Icon } from '../icons'
import { Brand } from './Brand'

export function LoginPage({ onAuthenticated, initialMessage }: { onAuthenticated: (user: SessionUser) => void; initialMessage?: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(initialMessage || 'Masukkan kredensial akun lokal Anda.')

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('Memverifikasi akun secara lokal…')
    try { const result = await login(username, password); onAuthenticated(result.user) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Akun tidak dapat diverifikasi.') }
    finally { setBusy(false) }
  }

  return <main className="login-shell" data-design-contract="Operate-mode local access checkpoint within the Cobalt Proof Sheet world.">
    <section className="login-proof" aria-labelledby="login-title">
      <Brand href="#" label="Beranda Transkrip"/>
      <div className="login-statement"><Icon name="shield"/><h1 id="login-title">Satu akun.<br/>Satu ruang kerja lokal.</h1><p>Setiap transkrip dipisahkan berdasarkan pemiliknya di SQLite. Kredensial dan sesi tetap berada pada layanan lokal perangkat ini.</p></div>
      <dl><div><dt>Autentikasi</dt><dd>Cookie HttpOnly</dd></div><div><dt>Isolasi</dt><dd>Owner-scoped SQLite</dd></div><div><dt>Jaringan</dt><dd>Loopback lokal</dd></div></dl>
    </section>
    <form className="login-form" onSubmit={submit}>
      <header><span>Akses ruang kerja</span><strong>Masuk</strong></header>
      <label><span>Username</span><input autoFocus autoComplete="username" value={username} minLength={3} maxLength={50} required onChange={event => setUsername(event.target.value)} /></label>
      <label><span>Password</span><input type="password" autoComplete="current-password" value={password} minLength={12} maxLength={128} required onChange={event => setPassword(event.target.value)} /></label>
      <p role="status" aria-live="polite">{message}</p>
      <button disabled={busy}><Icon name="shield"/>{busy ? 'Memverifikasi…' : 'Masuk ke Transkrip'}</button>
      <small>Administrator membuat dan mengelola akun. Tidak ada pendaftaran publik atau pemulihan melalui cloud.</small>
    </form>
  </main>
}
