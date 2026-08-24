import { Icon } from '../icons'
import { Brand } from './Brand'

const runtimeLayers = [
  ['Antarmuka', 'React + TypeScript', 'Kontrol audio, peninjauan, penyuntingan, dan ekspor'],
  ['Dekode audio', 'Web Audio API', 'Mono Float32 PCM · 16 kHz · sesi browser'],
  ['Pengenalan suara', 'whisper.cpp + WASM', 'Worker khusus · CPU lokal · potongan 30 detik'],
  ['Koreksi opsional', 'Sahabat-AI + Ollama', 'Dipicu pengguna · hanya loopback 127.0.0.1'],
]

const releaseRecords = [
  ['Model utama', 'Base multilingual · 141 MB'],
  ['Model akurat', 'Small Q5_1 multilingual · 181 MB'],
  ['Model Bahasa', 'Cahya Medium Q5_0 · 514 MB'],
  ['Model koreksi', 'csalab/sahabatai1:llama3_base_Q4_K_M'],
]

export function AboutPage() {
  return <main className="about-shell">
    <header className="about-command-bar">
      <Brand href="#workspace" className="about-brand" label="Kembali ke ruang kerja Transkrip"/>
      <div className="privacy-state"><Icon name="shield"/><span><b>Arsitektur lokal</b><small>Privasi sebagai batas sistem</small></span></div>
      <div className="about-location"><span>Menu</span><strong>About</strong></div>
      <a className="about-back" href="#workspace"><Icon name="back"/>Workspace</a>
    </header>

    <section className="about-intro" aria-labelledby="about-title">
      <div className="about-statement">
        <div className="about-raster" aria-hidden="true"/>
        <h1 id="about-title">Rekaman bekerja di perangkat Anda, bukan di server kami.</h1>
        <p>Transkrip adalah ruang kerja Bahasa Indonesia dan English untuk mengubah audio menjadi teks yang dapat diperiksa tanpa membangun salinan cloud dari percakapan Anda.</p>
      </div>
      <aside className="maintainer-record" aria-labelledby="maintainer-title">
        <Icon name="info"/>
        <span id="maintainer-title">Maintainer dan release owner</span>
        <strong>Adnuri Mohamidi</strong>
        <p>Menjaga batas privasi, persetujuan model, kualitas rilis, konfigurasi produksi, dan kesiapan rollback.</p>
      </aside>
    </section>

    <section className="about-ledger" aria-label="Catatan sistem Transkrip">
      <article className="about-section runtime-ledger">
        <header><h2>Alur yang dapat diperiksa</h2><p>Empat lapisan, satu perangkat.</p></header>
        <ol>{runtimeLayers.map(([name, technology, detail], index) => <li key={name}>
          <span className="ledger-index">{String(index + 1).padStart(2, '0')}</span>
          <div><b>{name}</b><strong>{technology}</strong><p>{detail}</p></div>
          <span className="local-mark">Lokal</span>
        </li>)}</ol>
      </article>

      <article className="about-section release-ledger">
        <header><h2>Rekaman rilis</h2><p>Artefak yang disetujui untuk build ini.</p></header>
        <dl>{releaseRecords.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
        <div className="privacy-rule"><Icon name="shield"/><p><b>Rekaman dan transkrip tidak diunggah atau disimpan server.</b> Model bawaan dikirim sebagai aset statis dari origin aplikasi, lalu dimuat ke memori browser untuk inferensi lokal. Berkas hasil dibuat hanya ketika pengguna memilih ekspor.</p></div>
      </article>
    </section>

    <section className="about-principles" aria-labelledby="principles-title">
      <h2 id="principles-title">Prinsip operasi</h2>
      <div><article><h3>Lokal harus terlihat</h3><p>Status model, mesin, dan koreksi selalu menyebut tempat pemrosesan. Privasi bukan klaim tersembunyi.</p></article><article><h3>Bukti sebelum ekspor</h3><p>Setiap paragraf tetap terhubung ke waktu audio agar pengguna dapat memeriksa, menyunting, lalu memilih hasilnya sendiri.</p></article><article><h3>Kegagalan tetap aman</h3><p>Batas ukuran, waktu, respons, dan perubahan teks mempertahankan data asli ketika mesin lokal tidak dapat memberi hasil yang konservatif.</p></article></div>
    </section>

    <footer className="about-footer"><span>Transkrip · on-device transcription workstation</span><a href="#workspace"><Icon name="back"/>Workspace</a></footer>
  </main>
}
