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
