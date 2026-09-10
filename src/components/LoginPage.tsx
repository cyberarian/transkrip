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

  return <main className="login-shell" data-design-contract="Private transcription studio.">
    <section className="login-proof" aria-labelledby="login-title">
      <Brand href="#" label="Beranda Transkrip"/>
      <div className="login-statement"><h1 id="login-title">Percakapan Anda.<br/><em>Lebih bermakna.</em></h1><p>Ubah rekaman menjadi transkrip yang siap dibaca, ditinjau, dan dianalisis dengan AI lokal. Semua tetap di perangkat Anda.</p><div className="login-sound" aria-hidden="true">{Array.from({ length:  48 }, (_, index) => <i key={index}/>)}</div><div className="login-caption"><Icon name="shield"/> Suara menjadi teks. Privasi tetap milik Anda.</div></div>
      <dl><div><dt>Transkripsi</dt><dd>Di perangkat Anda</dd></div><div><dt>Bahasa</dt><dd>Indonesia + English</dd></div><div><dt>Analisis AI</dt><dd>Model lokal</dd></div></dl>
    </section>
    <form className="login-form" onSubmit={submit}>
      <header><strong>Selamat datang.</strong><p>Masuk untuk melanjutkan percakapan Anda.</p></header>
      <label><span>Username</span><input autoFocus autoComplete="username" value={username} minLength={3} maxLength={50} required onChange={event => setUsername(event.target.value)} /></label>
      <label><span>Password</span><input type="password" autoComplete="current-password" value={password} minLength={12} maxLength={128} required onChange={event => setPassword(event.target.value)} /></label>
      <p role="status" aria-live="polite">{message}</p>
      <button disabled={busy}><Icon name="shield"/>{busy ? 'Memverifikasi…' : 'Masuk ke Transkrip'}</button>
      <small>Administrator membuat dan mengelola akun. Tidak ada pendaftaran publik atau pemulihan melalui cloud.</small>
    </form>
  </main>
}
