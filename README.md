# Transkrip

Transkrip adalah aplikasi transkripsi Bahasa Indonesia dan Inggris yang berjalan secara lokal di perangkat Anda. Aplikasi ini mengubah rekaman menjadi transkrip yang dapat ditinjau, dicari, dan diekspor. Pengenalan suara berjalan di browser; transkrip dan riwayat disimpan di SQLite lokal. Tidak ada transkripsi cloud, basis data cloud, analitik, atau pelaporan galat jarak jauh.

<p align="center">
  <img src="public/workspace.png" alt="Ruang kerja Transkrip" width="620" />
</p>

**Versi bahasa Inggris:** [README in English](README.en.md)

Transkrip dirancang untuk rapat, wawancara, kuliah, konsultasi, dan sejarah lisan. Aplikasi ini menggabungkan antarmuka React, whisper.cpp WebAssembly, riwayat SQLite, serta dukungan opsional untuk FFmpeg, pyannote.audio, dan DocETL/Ollama.

[Persyaratan](#persyaratan) · [Mulai cepat](#mulai-cepat) · [Jenis dan batas file](#jenis-dan-batas-file) · [Privasi](#privasi-dan-penyimpanan-data) · [Perintah](#perintah)

## Fitur

- Transkripsi lokal Bahasa Indonesia, Inggris, atau campuran keduanya.
- Model whisper.cpp berjalan di browser melalui WebAssembly dan Web Worker.
- Pilihan model Base multilingual, Small Q5_1 multilingual, dan Cahya Medium Q5_0 untuk Bahasa Indonesia.
- Editor transkrip dengan cap waktu, pencarian, label pembicara, dan koreksi.
- Ekspor transkrip TXT, SRT, dan DOCX; hasil analisis dapat diekspor sebagai TXT, Markdown, JSON, dan DOCX.
- Riwayat transkrip lokal dengan pencarian teks penuh dan penyimpanan otomatis.
- Pemrosesan opsional di perangkat: persiapan media dengan FFmpeg, pemisahan pembicara dengan pyannote.audio, dan analisis dengan DocETL/Ollama.
- Beberapa akun lokal dengan peran administrator dan pemisahan data setiap akun.
- Antarmuka responsif, aksesibel melalui papan ketik, dan mendukung pengurangan gerakan.

## Persyaratan

- macOS, Linux, atau Windows.
- Node.js 24 atau lebih baru dan npm 12.
- Git LFS untuk model browser yang disertakan.
- Browser berbasis Chromium terbaru disarankan untuk dukungan WebAssembly dan model besar.
- Opsional: FFmpeg 6+ untuk menyiapkan rekaman besar; Ollama untuk pemrosesan teks dan analisis lokal; Python untuk pemisahan pembicara atau DocETL.

Transkripsi menggunakan CPU melalui WebAssembly. GPU tidak diperlukan. Kebutuhan RAM bergantung pada model yang dipilih:

| Model | RAM minimum | RAM yang disarankan | Kegunaan |
|---|---:|---:|---|
| Base multilingual | 4 GB | 8 GB | Pilihan multilingual paling ringan |
| Small Q5_1 multilingual | 6 GB | 8 GB | Keseimbangan kecepatan dan akurasi untuk Bahasa Indonesia dan Inggris |
| Cahya Medium Q5_0 | 8 GB | 16 GB | Fokus Bahasa Indonesia; penggunaan CPU lebih tinggi |

## Mulai cepat

Salin templat konfigurasi:

```bash
cp .env.example .env
```

Di Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Atur `TRANSKRIP_ADMIN_USERNAME` dan `TRANSKRIP_ADMIN_PASSWORD` di `.env` sebelum menjalankan aplikasi untuk pertama kali. Gunakan kata sandi unik sepanjang 12–128 karakter. Berkas `.env` diabaikan oleh Git. Setelah akun administrator berhasil dibuat dan Anda dapat masuk, hapus semua entri `TRANSKRIP_ADMIN_*` dari `.env`.

Jalankan dari direktori proyek:

```bash
git lfs install
npm ci
npm run check
npm run dev -- --host 127.0.0.1
```

Buka [http://127.0.0.1:5173](http://127.0.0.1:5173). Server hanya terikat ke perangkat lokal. Masuk dengan akun administrator yang dikonfigurasi tadi.

Untuk menjalankan versi produksi lokal:

```bash
npm run build
npm start
```

Buka [http://127.0.0.1:8787](http://127.0.0.1:8787). Untuk rincian konfigurasi lanjutan dan opsi layanan lokal, lihat [panduan bahasa Inggris](README.en.md).

## Jenis dan batas file

| Jenis | Format | Batas dan catatan |
|---|---|---|
| Audio | WAV, MP3, M4A/AAC, Ogg/Opus, FLAC, WebM audio | Hingga 250 MB dan empat jam dalam mode browser; pemutaran dan dekode bergantung pada dukungan codec browser. |
| Video | MP4 dengan trek audio | Hanya audio yang ditranskripsikan. Format lain seperti MOV, MKV, AVI, dan WebM video memerlukan FFmpeg lokal. |
| Model suara | GGML `.bin` | Model whisper.cpp yang kompatibel, maksimal 750 MB. |
| Ekspor transkrip | TXT, SRT, DOCX | Berkas keluaran; bukan format masukan transkrip. |
| Ekspor analisis | TXT, Markdown, JSON, DOCX | Analisis menggunakan transkrip yang tersimpan, bukan unggahan dokumen atau media. |

FFmpeg lokal opsional menaikkan batas ukuran media hingga 2 GiB. Batas durasi empat jam tetap berlaku. Berkas di atas 100 MB meminta konfirmasi sebelum dimuat. Batas tersebut tidak menjamin berkas akan muat di memori perangkat. PDF, DOCX, gambar, dan berkas subtitle bukan masukan rekaman.

Untuk menyiapkan trek audio pertama dari video secara manual:

```bash
ffmpeg -i input.mp4 -map 0:a:0 -vn -ac 1 -ar 16000 -c:a pcm_s16le audio.wav
```

Mengubah ekstensi nama berkas saja tidak mengonversi format audio.

## Privasi dan penyimpanan data

- Whisper memproses audio di browser. Audio tidak dikirim ke layanan cloud dan tidak disimpan sebagai data audio di SQLite.
- Riwayat, akun lokal, dan transkrip tersimpan di `data/transkrip.sqlite`. Seluruh direktori `data/` diabaikan oleh Git.
- FFmpeg, pyannote.audio, Ollama, dan DocETL adalah layanan opsional yang berjalan di perangkat yang sama. Teks hanya dikirim ke Ollama atau DocETL ketika pengguna meminta koreksi, normalisasi, atau analisis.
- Berkas media sementara dihapus setelah pemrosesan selesai, gagal, atau dibatalkan. Penghentian proses secara paksa dapat meninggalkan berkas sementara sampai persiapan berikutnya berjalan.
- Kata sandi disimpan sebagai hash scrypt; token sesi tidak disimpan dalam bentuk teks biasa. Cookie sesi menggunakan `HttpOnly` dan `SameSite=Strict`.
- Administrator mengelola akun, tetapi tidak mendapat akses lintas akun ke transkrip pengguna lain.
- Jangan mengekspos layanan lokal ke jaringan lokal atau internet tanpa mengubah rancangan privasi dan keamanan.

Untuk mencadangkan riwayat, hentikan aplikasi lalu salin `data/transkrip.sqlite` serta berkas `-wal` dan `-shm` yang ada di sebelahnya. Pulihkan berkas hanya saat aplikasi berhenti.

## Layanan lokal opsional

- **FFmpeg** menyiapkan audio dari media besar. Pasang FFmpeg 6+ dengan protokol `fd`; atur `TRANSKRIP_FFMPEG` bila executable tidak ada di `PATH`.
- **Ollama** menyediakan koreksi ejaan lokal, normalisasi bilingual, dan dasar bagi analisis DocETL. Secara bawaan Ollama harus mendengarkan di `127.0.0.1:11434`.
- **pyannote.audio** menambahkan perkiraan cap waktu pergantian pembicara. Layanan Python berjalan di `127.0.0.1:8765` dan memerlukan akses model Hugging Face Community-1.
- **DocETL** menghasilkan notula, daftar tindakan, atau tema lintas transkrip terpilih. Layanan analisis lokal berjalan di `127.0.0.1:8770`.

Pengenalan suara dan riwayat transkrip tetap dapat digunakan tanpa layanan opsional tersebut. Petunjuk instalasi rinci tersedia di [README bahasa Inggris](README.en.md).

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan Vite dan API SQLite lokal |
| `npm run build` | Memeriksa dan membangun aplikasi ke `dist/` |
| `npm start` | Menjalankan build produksi dan API di `127.0.0.1:8787` |
| `npm run lint` | Menjalankan ESLint |
| `npm test` | Menjalankan pengujian Vitest dan server Node |
| `npm run typecheck` | Memeriksa tipe TypeScript |
| `npm run assets:verify` | Memeriksa checksum model dan runtime Whisper |
| `npm run check` | Menjalankan lint, pengujian, pemeriksaan tipe, checksum, dan build |
| `npm run whisper:build` | Membangun ulang runtime WebAssembly whisper.cpp |

Pengujian media memerlukan FFmpeg. Pengujian kontrak analisis Python dijalankan terpisah:

```bash
python3 -m unittest discover -s analysis -p "test_*.py"
```

## Struktur proyek

```text
analysis/       Layanan analisis DocETL lokal
diarization/    Layanan pemisahan pembicara pyannote.audio
docs/           Dokumentasi teknis dan keputusan desain
public/models/  Model suara browser yang dikelola dengan Git LFS
server/         API Node, autentikasi, SQLite, dan integrasi lokal
src/            Antarmuka React dan logika browser
```

## Kontribusi dan lisensi

Periksa dokumentasi proyek dan jalankan `npm run check` sebelum mengajukan perubahan. Transkrip dirilis dengan lisensi yang tercantum di [LICENSE](LICENSE).

**Pemelihara:** Adnuri Mohamidi
