
# Modul Akademik

Endpoint yang berhubungan dengan hasil akhir akademik seperti rapor dan transkrip.

---

## 1. Generate Rapor Siswa

**Endpoint:**  
- `GET /akademik/rapor/:siswaId` (Untuk Guru/Admin)  
- `GET /akademik/rapor-saya` (Untuk Siswa)  

**Deskripsi:**  
Menghasilkan data rapor digital untuk seorang siswa pada semester dan tahun ajaran tertentu.

**Akses:** Guru, Super Admin, Siswa (hanya miliknya)

**Headers:**

| Key | Value |
| :--- | :--- |
| Authorization | Bearer <token> |

**URL Params (hanya untuk Guru/Admin):**

| Parameter | Tipe | Deskripsi |
| :--- | :--- | :--- |
| siswaId | String | Wajib. ID siswa yang rapornya akan dibuat. |

**Query Params:**

| Parameter | Tipe | Deskripsi |
| :--- | :--- | :--- |
| tahunAjaran | String | Wajib. Contoh: 2024/2025. |
| semester | String | Wajib. ganjil atau genap. |

**Response 200 (Sukses):**
```json
{
    "informasiSiswa": {
        "nama": "Rina Sari",
        "nis": "S24001",
        "kelas": "X DKV 1",
        "tahunAjaran": "2024/2025",
        "semester": "ganjil",
        "waliKelas": "Budi Santoso"
    },
    "nilaiAkademik": [
        {
            "mataPelajaran": "Dasar Desain Grafis",
            "kodeMapel": "DKV-X-01",
            "nilai": 88,
            "jenis": "uts",
            "deskripsi": "Memahami konsep dengan baik"
        },
        {
            "mataPelajaran": "Dasar Desain Grafis",
            "kodeMapel": "DKV-X-01",
            "nilai": 92,
            "jenis": "tugas",
            "deskripsi": "Tugas: Tugas 1: Analisis Poster"
        }
    ],
    "rekapAbsensi": {
        "hadir": 50,
        "sakit": 1,
        "izin": 0,
        "alpa": 0
    },
    "catatanWaliKelas": "Tetap semangat dan tingkatkan lagi prestasimu!"
}
```

---

## 2. Generate Transkrip Nilai Siswa

**Endpoint:**  
- `GET /akademik/transkrip/:siswaId` (Untuk Guru/Admin)  
- `GET /akademik/transkrip-saya` (Untuk Siswa)  

**Deskripsi:**  
Menghasilkan transkrip nilai kumulatif seorang siswa selama bersekolah.

**Akses:** Guru, Super Admin, Siswa (hanya miliknya)

**Headers:**

| Key | Value |
| :--- | :--- |
| Authorization | Bearer <token> |

**URL Params (hanya untuk Guru/Admin):**

| Parameter | Tipe | Deskripsi |
| :--- | :--- | :--- |
| siswaId | String | Wajib. ID siswa. |

**Response 200 (Sukses):**
```json
{
    "informasiSiswa": {
        "nama": "Rina Sari",
        "nis": "S24001"
    },
    "ipk": "89.50",
    "detailTranskrip": {
        "2024/2025 - Semester ganjil": {
            "kelas": "X DKV 1",
            "nilai": [
                {
                    "mataPelajaran": "Dasar Desain Grafis",
                    "kodeMapel": "DKV-X-01",
                    "nilai": 88
                },
                 {
                    "mataPelajaran": "Matematika",
                    "kodeMapel": "MTK-X-01",
                    "nilai": 91
                }
            ]
        }
    }
}
```

