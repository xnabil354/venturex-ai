# Detail analisis hipotesis calon pengusaha

**Historical V1 design.** Replaced by [Entrepreneur Deep Analysis v2](Entrepreneur%20Deep%20Analysis.md). The current UI uses persisted second-stage analysis, full profile context and explicit preliminary-score coverage. The transient V1 simulator/formulas below are retained as historical implementation notes, not the current detail contract.

Implementasi 21 Oktober 2026. Acuan: BRD journey A Step 5 Analyze, BR-010 sampai BR-014, serta Tech Stack Requirement bagian 58–59. Scope: detail hipotesis privat milik calon pengusaha; Step 6 Compare dijelaskan sebagai rancangan berikutnya, belum diimplementasikan.

## Alur dan batas data

Tombol **Lihat Detail Score** pada kartu Finder dan Saved Opportunities membuka `/opportunities/hypotheses/{id}`. Server memvalidasi UUID, autentikasi, onboarding selesai dan role ENTREPRENEUR sebelum membaca hipotesis dengan kondisi gabungan `id`, `userId`, `userType=ENTREPRENEUR`. Row tidak ada, role salah, dan row akun lain menghasilkan 404. Pengambilan profil dan referensi dilakukan setelah kepemilikan terverifikasi. Halaman tidak memanggil SearchApi atau LLM.

Detail mencakup dua skor, target konsumen, kompetisi, risiko, kebutuhan awal dan bukti. Bukti historis tetap menampilkan waktu dan filter aslinya; simulasi memakai profil saat halaman dibuka. Teks AI adalah hipotesis, bukan hasil survei. Data kompetitor, risiko terukur, kebutuhan modal dan hasil pembelian tidak boleh ditebak dari narasi atau Google Trends.

## Opportunity Score

Pure function menggunakan mesin `calculateOpportunityScore` yang ada. Policy lokal `PRIVATE_SEARCH_EVIDENCE_V1`, terpisah dari lifecycle scoring katalog publik. Ini heuristik awal yang belum dikalibrasi terhadap hasil usaha, bukan standar empiris atau probabilitas keberhasilan.

| Faktor | Bobot | Sumber yang dapat dipakai saat ini |
|---|---:|---|
| Trend momentum | 25% | Rising numerik: `100 × g / (100 + g)`, g adalah pertumbuhan persen nonnegatif |
| Minat pencarian relatif | 20% | Top: indeks sumber 0–100, hanya proxy minat pencarian |
| Kompetisi | 15% | Belum tersedia |
| Respons calon pembeli | 15% | Belum tersedia |
| Kelayakan pelaksanaan | 15% | Belum tersedia |
| Ketahanan pasar | 10% | Belum tersedia |

Total bobot = 1. Skor penuh `Σ(nilai × bobot)`, pembulatan HALF_UP dua desimal. Semua faktor harus diketahui. Faktor hilang tetap null, tidak dianggap nol dan bobot tidak dinormalisasi ulang. Karena satu kueri pilihan belum menyediakan semua faktor, skor penuh saat ini ditampilkan `—` beserta alasan dan rincian faktor. Nilai Top lebih dari 100 tidak dipakai. Breakout tetap label; tidak dikonversi menjadi persentase atau angka skor. Sumber Bright Data historis tidak memiliki faktor numerik yang kompatibel.

Kelengkapan = jumlah bobot faktor dengan nilai × 100%; ini kelengkapan faktor, bukan confidence dan bukan kualitas bukti. Sumber Top dapat mengisi 20%; sumber Rising numerik dapat mengisi 25%. Perbandingan nilai sumber lintas wilayah, periode dan kumpulan kueri tidak dianggap sebagai ranking pasar yang setara.

## Fit Score simulasi

Menggunakan policy existing `FIT_MVP_HEURISTIC_V1` (ENTREPRENEUR_FIT), tanpa mengganti formula global:

`Fit = 0,4 × modal + 0,3 × minat + 0,3 × kanal`.

- Modal 100 bila `budget.max >= estimasi modal minimum`; jika tidak 0. Budget profil adalah rentang yang dinyatakan, bukan uang yang telah diverifikasi tersedia.
- Minat 100 bila ID kategori peluang yang dikonfirmasi termasuk ID kategori minat profil; jika tidak 0.
- Kanal 100 bila ID kanal utama peluang termasuk ID kanal profil; jika tidak 0.
- ID harus berasal dari referensi aktif. Input modal harus integer rupiah nonnegatif dan aman secara numerik. Input kosong tidak menjadi nol.
- Ketiga input skenario wajib ada sebelum skor dihitung. Mengubah input menghapus hasil simulasi sebelumnya. Perhitungan dan pembulatannya menggunakan mesin Fit Score existing.
- Lokasi, pengalaman dan waktu dikecualikan sesuai policy MVP existing dan dijelaskan kepada pengguna. Skor 100 hanya berarti tiga kriteria ini cocok.

Skenario dikonfirmasi pengguna, tidak dihasilkan atau diverifikasi AI, tidak disimpan, tidak mengubah profil/hipotesis, dan tidak dipakai sebagai evidence generasi. Halaman mengirim ke client hanya budget, ID kategori dan kanal yang diperlukan; catatan dan informasi akun tidak dibutuhkan.

## Kompetisi, risiko dan kebutuhan awal

Kompetisi dan tingkat risiko tetap **belum dinilai** sampai ada data yang sesuai. Asumsi hipotesis dan rencana validasi ditampilkan sebagai hal yang perlu diuji. Skenario kebutuhan awal dibedakan dari biaya terverifikasi; tidak ada proyeksi balik modal, laba atau jaminan sukses. Tampilan responsif menggunakan token DESIGN.md: parchment, white, wine dan lilac; form berlabel, target sentuh minimum 44px, fokus terlihat dan status aksesibel.

## Relevansi Step 6 Compare — rancangan lanjutan

Analyze menjawab “apa dasar dan keterbatasan satu ide?”. Compare membantu memilih ide mana yang diuji dahulu ketika pengguna memiliki beberapa kandidat. Alur yang disarankan: buat hipotesis di Finder → buka detail → simpan kandidat → pilih 2–3 kandidat di Saved Opportunities → bandingkan atribut sejajar (skor, kelengkapan faktor, target, kompetisi, risiko, kebutuhan modal, kanal, dan langkah uji). Compare tidak membuat skor AI baru.

Gunakan versi formula yang sama; labeli skenario dan waktu profil/bukti. Data kosong tetap “belum tersedia”, bukan nol. Sinyal lintas geo/periode/kumpulan kueri tidak boleh dijadikan ranking langsung. Jangan otomatis menyatakan pemenang jika faktor atau sumbernya tidak sebanding. Implementasi Compare dan roadmap tidak termasuk revisi ini.
