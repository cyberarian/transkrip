import { useState } from 'react'
import { APPEARANCE_PRESETS, getAppearance, saveAppearance, type AppearanceId } from '../appearance'
import { Icon } from '../icons'
import { Brand, BrandMark } from './Brand'

const proofRows = [
  { time: '00:04', speaker: 'Pembicara 1', language: 'ID', text: 'Kita mulai dari bagian yang perlu diperiksa terlebih dahulu.' },
  { time: '00:11', speaker: 'Speaker 2', language: 'EN', text: 'The mixed-language phrase stays natural and keeps its original intent.' },
  { time: '00:19', speaker: 'Pembicara 1', language: 'ID', text: 'Setelah itu, ejaan dirapikan oleh model yang berjalan secara lokal.' },
]

const workflow = [
  ['Masukkan rekaman', 'Audio didekode di browser dan tidak dikirim ke layanan transkripsi cloud.'],
  ['Periksa dengan bukti', 'Setiap paragraf tetap terhubung ke waktu audio dan pembicara yang terdeteksi.'],
  ['Rapikan & ekspor', 'Sunting langsung, normalisasi dengan Ollama lokal, lalu unduh TXT atau SRT.'],
]

export function LandingPage() {
  const [appearance, setAppearance] = useState(() => getAppearance())

  const chooseAppearance = (next: AppearanceId) => {
    try {
      saveAppearance(next)
      setAppearance(next)
    } catch {
      // The existing preset remains active when browser storage is unavailable.
    }
  }

  return <main className="landing-shell">
    <header className="landing-nav">
      <Brand href="#" className="landing-brand" label="Beranda Transkrip"/>
      <div className="landing-local"><Icon name="shield"/><span><b>Lokal dari awal sampai akhir</b><small>Audio, teks, dan model tetap di perangkat</small></span></div>
      <nav aria-label="Navigasi utama">
        <a href="#tasks">Tasks</a><a href="#analysis">Analysis</a><a href="#settings">Settings</a><a href="#about">About</a>
      </nav>
      <a className="landing-open" href="#workspace">Workspace <Icon name="forward"/></a>
    </header>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-pitch">
        <span className="landing-status"><i/> Transkripsi lokal · Bahasa Indonesia + English</span>
        <h1 id="landing-title">Dengar rekamannya.<br/><em>Periksa setiap kata.</em></h1>
        <p>Ruang kerja transkripsi yang menjaga percakapan sensitif di perangkat Anda—dari suara mentah, label pembicara, koreksi ejaan, sampai dokumen akhir.</p>
        <div className="landing-actions"><a href="#workspace">Mulai transkripsi <Icon name="forward"/></a><a href="#about">Lihat cara kerja</a></div>
        <dl className="landing-facts"><div><dt>Mesin suara</dt><dd>whisper.cpp</dd></div><div><dt>Penyimpanan</dt><dd>SQLite lokal</dd></div><div><dt>Koreksi</dt><dd>Ollama lokal</dd></div></dl>
      </div>

      <div className="landing-proof" aria-label="Pratinjau transkrip ilustratif">
        <header><span><i/> REKAMAN_07.WAV</span><span>00:24 / 18:42</span></header>
        <div className="proof-wave" aria-hidden="true">{Array.from({ length: 48 }, (_, index) => <i key={index}/>)}</div>
        <div className="proof-document">
          <div className="proof-heading"><span>Pratinjau transkrip</span><b>Ilustrasi · 2 pembicara · ID + EN</b></div>
          {proofRows.map((row, index) => <article className={index === 1 ? 'active' : ''} key={row.time}>
            <time>{row.time}</time><div><span>{row.speaker} · {row.language}</span><p>{row.text}</p></div>
          </article>)}
        </div>
        <footer><span><Icon name="shield"/> Pemrosesan perangkat</span><b>Tidak ada unggahan cloud</b></footer>
      </div>
    </section>

    <section className="landing-boundary" aria-label="Batas data lokal">
      <div><Icon name="shield"/><strong>Satu perangkat.<br/>Satu batas data.</strong></div>
      <p>Model pengenal suara berjalan di browser. Riwayat tersimpan dalam SQLite pada mesin yang sama. Diarisasi dan koreksi teks hanya berbicara ke layanan loopback lokal yang Anda jalankan sendiri.</p>
      <a href="#about">Periksa arsitektur <Icon name="forward"/></a>
    </section>

    <section className="landing-workflow" aria-labelledby="workflow-title">
      <header><h2 id="workflow-title">Dari suara mentah ke naskah yang siap dibaca.</h2><p>Tiga tahap yang selalu dapat ditinjau dan dikendalikan pengguna.</p></header>
      <ol>{workflow.map(([title, detail], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol>
    </section>

    <section className="landing-types" aria-labelledby="landing-types-title">
      <div className="landing-types-copy"><h2 id="landing-types-title">Baca dengan karakter yang cocok untuk pekerjaan Anda.</h2><p>Tipografi bukan kosmetik. Pilih suara modern, klasik, atau konsol bukti; metadata teknis tetap presisi dalam setiap gaya.</p><a href="#settings">Pengaturan lengkap <Icon name="forward"/></a></div>
      <fieldset><legend>Pilih tipografi aplikasi</legend>{APPEARANCE_PRESETS.map(preset => <label htmlFor={`landing-appearance-${preset.id}`} className={`landing-type landing-type-${preset.id}${appearance === preset.id ? ' selected' : ''}`} key={preset.id}>
        <input id={`landing-appearance-${preset.id}`} type="radio" name="landing-appearance" checked={appearance === preset.id} onChange={() => chooseAppearance(preset.id)}/><span aria-hidden="true"/><b>{preset.name}</b><p>{preset.sample}</p><small>{appearance === preset.id ? 'Aktif' : 'Pilih gaya'}</small>
      </label>)}</fieldset>
    </section>

    <footer className="landing-footer"><div><BrandMark/><strong>transkrip</strong><p>Dipelihara oleh Adnuri Mohamidi.</p></div><a href="#workspace">Workspace <Icon name="forward"/></a></footer>
  </main>
}
