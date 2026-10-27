# SIAKOFF - Sistem Import Banyak File Excel

Aplikasi Flask untuk memilih dan memproses banyak file Excel sekaligus, memetakan kolom L/P/JML ke struktur `DATA_LAPORAN_PENDUDUK`, lalu menggabungkan hasil sebelum upload ke MySQL/MariaDB.

## Fitur
- Pilih banyak `.xlsx` / `.xls` sekaligus.
- SECT dapat diisi berbeda untuk setiap file.
- Deteksi pola kolom:
  - `LK_MMLK`, `PR_MMLK`, `JML_MMLK`
  - `LK_BLM_MLK`, `PR_BLM_MLK`, `JML_BLM_MLK`
  - `L_RLS`, `P_RLS`, `JML_RLS`
  - `RLS_L`, `RLS_P`, `RLS_JML`
  - `MEDIAN_L`, `MEDIAN_P`, `MEDIAN_JML`
- DESCRIP diambil dari bagian nama kolom setelah/before indikator gender/jumlah.
- Deteksi kode wilayah dengan titik maupun format angka gabungan.
- Preview hasil gabungan.
- Export hasil mapping ke Excel.
- Satu tombol untuk memasukkan seluruh hasil ke MySQL/MariaDB.

## Menjalankan

```powershell
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Buka `http://127.0.0.1:5000`.

## Database

Default:
- Host: `localhost`
- Port: `3306`
- User: `root`
- Password: kosong
- Database: `SIAKOFF`
- Table: `DATA_LAPORAN_PENDUDUK`

Nilai dapat diubah menggunakan environment variable `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, dan `DB_TABLE`.

### Login Admin

Login admin membaca pengguna dari tabel `SIAK_USER` pada database yang sama. Buat tabel MySQL berikut sebelum menjalankan aplikasi:

```sql
CREATE TABLE IF NOT EXISTS SIAK_USER (
  SIAK_USER VARCHAR(20) NOT NULL PRIMARY KEY,
  SIAK_PASSWORD VARCHAR(100) NULL,
  FULLNAME VARCHAR(100) NULL,
  NIP VARCHAR(18) NULL,
  USER_LEVEL TINYINT NULL
);
```

Untuk mengimpor akun contoh dari file SQL Oracle yang disertakan, gunakan tabel di atas lalu masukkan baris berikut di MySQL:

```sql
INSERT INTO SIAK_USER (SIAK_USER, SIAK_PASSWORD, FULLNAME, NIP, USER_LEVEL)
VALUES ('admin', '21232f297a57a5a743894a0e4a801fc3', 'Ini Admin', '123', 0);
```

Akun contoh tersebut menggunakan password `admin`. Hash MD5 ini hanya didukung agar cocok dengan data sumber lama; MD5 tidak aman untuk penyimpanan password baru. Ganti password awal dan rencanakan migrasi ke hash password modern sebelum digunakan pada lingkungan produksi.

Tetapkan `FLASK_SECRET_KEY` ke nilai rahasia yang kuat dan stabil agar sesi login tetap valid setelah aplikasi dimulai ulang. Contoh PowerShell untuk sesi terminal saat ini:

```powershell
$env:FLASK_SECRET_KEY = "ganti-dengan-rahasia-acak-yang-panjang"
python app.py
```

Halaman admin, impor, unggah, ekspor, dan penyajian internal memerlukan login. Halaman penyajian tamu tetap tersedia tanpa login.

Kolom hasil angka disimpan sebagai teks agar nilai sumber tetap sama, termasuk angka
desimal di bawah 1 dan tanda koma lokal. Sesuaikan struktur tabel MySQL:

```sql
ALTER TABLE DATA_LAPORAN_PENDUDUK
MODIFY NO_PROP VARCHAR(10),
MODIFY NO_KAB VARCHAR(10),
MODIFY NO_KEC VARCHAR(10),
MODIFY NO_KEL VARCHAR(10),
MODIFY LAKI_LAKI VARCHAR(50),
MODIFY PEREMPUAN VARCHAR(50),
MODIFY JUMLAH VARCHAR(50),
MODIFY NO VARCHAR(50),
MODIFY DESCRIP VARCHAR(100),
MODIFY SECT VARCHAR(100);
```

Sistem tidak menghitung `JUMLAH`. Jika kolom `JML`, `JUMLAH`, atau `TOTAL` tidak ada
di Excel, kolom `JUMLAH` dibiarkan kosong.

Kolom `TANGGAL` tetap menggunakan tipe `DATE` karena diisi melalui kalender dan dapat
digunakan untuk pencarian berdasarkan tanggal.

## Catatan
Sistem ini belum menetapkan kode SECT secara otomatis karena nilai SECT harus mengikuti modul/panduan project. Isi SECT per file pada UI sesuai modul yang berlaku.


## Penyajian Data DKB

Halaman **Penyajian DKB** tersedia melalui `http://127.0.0.1:5000/penyajian`. Filter yang tersedia adalah Tanggal, Fungsi, Kecamatan, dan Kelurahan. Tombol **Tampilkan data** memuat data sesuai filter.

Tabel penyajian menggunakan bentuk pivot: setiap kategori `DESCRIP` menjadi baris, sedangkan setiap kecamatan (ketika semua kecamatan dipilih) atau kelurahan (ketika satu kecamatan dipilih) menjadi grup kolom dengan subkolom **Laki-laki**, **Perempuan**, dan **Jumlah**. Judul laporan menampilkan fungsi, Kota Yogyakarta, serta bulan dan tahun berdasarkan tanggal yang dipilih. Tabel dapat digulir horizontal maupun vertikal.

Untuk menjalankan aplikasi, buka folder `DB`, aktifkan virtual environment milik Anda, lalu jalankan `python app.py`. Virtual environment tidak disertakan dalam arsip project; instal dependensi melalui `python -m pip install -r requirements.txt`.
