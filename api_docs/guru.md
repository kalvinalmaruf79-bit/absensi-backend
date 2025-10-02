# Modul Guru
Endpoint untuk fungsionalitas yang spesifik bagi pengguna dengan role **Guru**.

---

## 1. Get Dashboard Guru
- **Endpoint**: GET /guru/dashboard
- **Deskripsi**: Mendapatkan data ringkasan untuk halaman dashboard guru.
- **Akses**: Guru

**Headers:**
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

**Response 200 (Sukses):**
```json
{
    "guru": {
        "name": "Budi Santoso",
        "identifier": "G2024001",
        "mataPelajaran": [
            { "_id": "...", "nama": "Dasar Desain Grafis", "kode": "DKV-X-01" }
        ]
    },
    "jadwalHariIni": [
        {
            "_id": "...",
            "jamMulai": "08:00",
            "jamSelesai": "10:30",
            "kelas": { "_id": "...", "nama": "X DKV 1" },
            "mataPelajaran": { "_id": "...", "nama": "Dasar Desain Grafis" }
        }
    ],
    "pengumumanTerbaru": [
        // ...
    ],
    "statistik": {
        "totalMataPelajaran": 1,
        "totalKelas": 3,
        "totalSiswa": 90
    }
}
```

---

## 2. Membuat Materi Pelajaran
- **Endpoint**: POST /materi
- **Deskripsi**: Mengunggah materi pelajaran baru, bisa berupa file dan/atau link.
- **Akses**: Guru

**Headers:**
| Key           | Value                 |
| :------------ | :-------------------- |
| Authorization | Bearer <token>        |
| Content-Type  | multipart/form-data   |

**Request Body (form-data):**
| Key          | Tipe    | Deskripsi |
| :----------- | :------ | :-------- |
| judul        | String  | Wajib. |
| deskripsi    | String  | Wajib. |
| mataPelajaran| String  | Wajib. ID dari mata pelajaran. |
| kelas        | String  | Wajib. ID dari kelas. |
| links        | String  | Opsional. JSON string array objek, contoh: [{"title":"Video YouTube", "url":"http://..."}] |
| files        | File[]  | Opsional. Bisa mengunggah hingga 5 file. |

**Response 201 (Created):**
```json
{
    "message": "Materi berhasil dibuat.",
    "materi": {
        // ... detail materi
    }
}
```

---

## 3. Membuat Tugas
- **Endpoint**: POST /tugas
- **Deskripsi**: Membuat tugas baru untuk kelas dan mata pelajaran tertentu.
- **Akses**: Guru

**Headers:**
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

**Request Body:**
```json
{
    "judul": "Tugas 1: Analisis Poster",
    "deskripsi": "...",
    "mataPelajaran": "60d0fe4f5311236168a109de",
    "kelas": "60d0fe4f5311236168a109df",
    "deadline": "2025-11-15T17:00:00.000Z",
    "semester": "ganjil",
    "tahunAjaran": "2024/2025"
}
```

**Response 201 (Created):**
```json
{
    "message": "Tugas berhasil dibuat.",
    "tugas": {
        // ... detail tugas
    }
}
```

---

## 4. Input Nilai Massal
- **Endpoint**: POST /guru/nilai/bulk
- **Deskripsi**: Memasukkan nilai untuk banyak siswa sekaligus dalam satu request.
- **Akses**: Guru

**Headers:**
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

**Request Body:**
```json
{
    "kelasId": "60d0fe4f5311236168a109df",
    "mataPelajaranId": "60d0fe4f5311236168a109de",
    "jenisPenilaian": "uts",
    "semester": "ganjil",
    "tahunAjaran": "2024/2025",
    "nilaiSiswa": [
        {
            "siswaId": "60d0fe4f5311236168a109e0",
            "nilai": 88,
            "deskripsi": "Memahami konsep dengan baik"
        },
        {
            "siswaId": "60d0fe4f5311236168a109e1",
            "nilai": 75,
            "deskripsi": "Perlu latihan lebih banyak"
        }
    ]
}
```

**Response 200 (Sukses):**
```json
{
    "message": "Semua nilai berhasil disimpan."
}
```

---

## 5. Get Rekap Nilai Kelas
- **Endpoint**: GET /guru/kelas/:kelasId/rekap-nilai
- **Deskripsi**: Mendapatkan rekapitulasi nilai rata-rata per jenis penilaian untuk semua siswa di sebuah kelas.
- **Akses**: Guru

**Headers:**
| Key           | Value           |
| :------------ | :-------------- |
| Authorization | Bearer <token>  |

**URL Params:**
| Parameter | Tipe   | Deskripsi |
| :-------- | :----- | :-------- |
| kelasId   | String | Wajib. ID kelas |

**Query Params:**
| Parameter      | Tipe    | Deskripsi |
| :------------- | :------ | :-------- |
| mataPelajaranId| String  | Wajib. |
| semester       | String  | Wajib. |
| tahunAjaran    | String  | Wajib. |
| export         | Boolean | Opsional. Set true untuk mengunduh sebagai file Excel. |

**Response 200 (Sukses):**
```json
[
    {
        "siswaId": "60d0fe4f5311236168a109e0",
        "nama": "Rina Sari",
        "identifier": "S24001",
        "nilai": {
            "tugas": 92,
            "uts": 88
        }
    }
]
```

