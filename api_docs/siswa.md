# 📘 Modul Siswa
Endpoint untuk fungsionalitas yang spesifik bagi pengguna dengan role **Siswa**.

---

## 1. Get Dashboard Siswa
- **Endpoint**: `GET /siswa/dashboard`
- **Deskripsi**: Mendapatkan data ringkasan untuk halaman dashboard siswa.
- **Akses**: Siswa

### Headers
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

### Response 200 (Sukses)
```json
{
    "siswa": {
        "name": "Rina Sari",
        "identifier": "S24001",
        "kelas": {
            "_id": "...",
            "nama": "X DKV 1",
            "tingkat": "X",
            "jurusan": "Desain Komunikasi Visual"
        }
    },
    "jadwalMendatang": {
        "_id": "...",
        "hari": "selasa",
        "jamMulai": "08:00",
        "mataPelajaran": {
            "nama": "Dasar Desain Grafis"
        },
        "guru": {
            "name": "Budi Santoso"
        }
    },
    "tugasMendatang": [
        {
            "_id": "...",
            "judul": "Tugas 1: Analisis Poster",
            "deadline": "2025-11-15T17:00:00.000Z",
            "mataPelajaran": { "nama": "Dasar Desain Grafis" }
        }
    ],
    "statistikPresensi": {
        "hadir": 20,
        "izin": 1,
        "sakit": 0,
        "alpa": 0
    }
}
```

---

## 2. Get Jadwal Pelajaran Siswa
- **Endpoint**: `GET /siswa/jadwal`
- **Deskripsi**: Mendapatkan jadwal pelajaran siswa yang terstruktur per hari.
- **Akses**: Siswa

### Headers
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

### Query Params
| Parameter   | Tipe   | Deskripsi |
| :---------- | :----- | :-------- |
| tahunAjaran | String | Opsional. Filter berdasarkan tahun ajaran. |
| semester    | String | Opsional. Filter berdasarkan semester (ganjil/genap). |

### Response 200 (Sukses)
```json
{
    "senin": [],
    "selasa": [
        {
            "_id": "...",
            "jamMulai": "08:00",
            "jamSelesai": "10:30",
            "mataPelajaran": { "nama": "Dasar Desain Grafis", "kode": "DKV-X-01" },
            "guru": { "name": "Budi Santoso", "identifier": "G2024001" }
        }
    ],
    "rabu": [],
    "kamis": [],
    "jumat": [],
    "sabtu": []
}
```

---

## 3. Mengumpulkan Tugas
- **Endpoint**: `POST /tugas/:id/submit`
- **Deskripsi**: Mengunggah file jawaban untuk sebuah tugas.
- **Akses**: Siswa

### Headers
| Key           | Value                 |
| :------------ | :-------------------- |
| Authorization | Bearer <token>        |
| Content-Type  | multipart/form-data   |

### URL Params
| Parameter | Tipe   | Deskripsi |
| :-------- | :----- | :-------- |
| id        | String | Wajib. ID dari tugas yang akan dikumpulkan. |

### Request Body (form-data)
| Key  | Tipe | Deskripsi |
| :--- | :--- | :-------- |
| file | File | Wajib. File jawaban tugas. |

### Response 200 (Sukses)
```json
{
    "message": "Tugas berhasil dikumpulkan."
}
```

### Response 400 (Gagal)
```json
{
    "message": "Waktu pengumpulan tugas telah berakhir."
}
```

---

## 4. Get Notifikasi
- **Endpoint**: `GET /siswa/notifikasi`
- **Deskripsi**: Mendapatkan daftar notifikasi terbaru untuk siswa.
- **Akses**: Siswa

### Headers
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

### Query Params
| Parameter | Tipe   | Deskripsi |
| :-------- | :----- | :-------- |
| limit     | Number | Opsional. Jumlah notifikasi yang ingin diambil (default: 20). |

### Response 200 (Sukses)
```json
[
    {
        "_id": "...",
        "tipe": "nilai_baru",
        "judul": "Nilai Tugas: Tugas 1: Analisis Poster",
        "pesan": "Anda mendapatkan nilai 92 untuk tugas ini.",
        "isRead": false,
        "createdAt": "..."
    }
]
```

---

## 5. Tandai Notifikasi Telah Dibaca
- **Endpoint**: `PATCH /siswa/notifikasi/:id/read`
- **Deskripsi**: Menandai satu atau semua notifikasi sebagai telah dibaca.
- **Akses**: Siswa

### Headers
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

### URL Params
| Parameter | Tipe   | Deskripsi |
| :-------- | :----- | :-------- |
| id        | String | Wajib. ID notifikasi, atau gunakan `all` untuk menandai semua. |

### Response 200 (Sukses)
```json
{
    "message": "3 notifikasi ditandai telah dibaca."
}
```

---

## 6. Get Histori Aktivitas
- **Endpoint**: `GET /siswa/histori-aktivitas`
- **Deskripsi**: Mendapatkan daftar log aktivitas yang dilakukan oleh siswa (melihat materi, submit tugas, dll).
- **Akses**: Siswa

### Headers
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

### Query Params
| Parameter | Tipe   | Deskripsi |
| :-------- | :----- | :-------- |
| limit     | Number | Opsional. Jumlah log yang ingin diambil (default: 25). |

### Response 200 (Sukses)
```json
[
    {
        "_id": "...",
        "user": "60d0fe4f5311236168a109e0",
        "action": "SUBMIT_TUGAS",
        "details": "Mengumpulkan tugas 'Tugas 1: Analisis Poster'",
        "resourceId": "60d0fe4f5311236168a109df",
        "createdAt": "...",
        "updatedAt": "..."
    }
]
```

