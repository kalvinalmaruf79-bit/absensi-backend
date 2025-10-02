# Modul Fitur Umum
Endpoint yang dapat diakses oleh lebih dari satu role untuk keperluan umum seperti mengisi form dropdown.

---

## 1. Get Semua Mata Pelajaran Aktif
- **Endpoint**: GET /common/mata-pelajaran
- **Deskripsi**: Mendapatkan daftar semua mata pelajaran yang berstatus aktif. Berguna untuk dropdown.
- **Akses**: Semua Role

**Headers:**

| Key | Value |
| :--- | :--- |
| Authorization | Bearer <token> |

**Response 200 (Sukses):**
```json
[
    {
        "_id": "60d0fe4f5311236168a109de",
        "nama": "Dasar Desain Grafis",
        "kode": "DKV-X-01"
    },
    {
        "_id": "60d0fe4f5311236168a109ef",
        "nama": "Matematika",
        "kode": "MTK-X-01"
    }
]
```

---

## 2. Get Semua Kelas Aktif
- **Endpoint**: GET /common/kelas
- **Deskripsi**: Mendapatkan daftar semua kelas yang berstatus aktif. Berguna untuk dropdown.
- **Akses**: Semua Role

**Headers:**

| Key | Value |
| :--- | :--- |
| Authorization | Bearer <token> |

**Response 200 (Sukses):**
```json
[
    {
        "_id": "60d0fe4f5311236168a109df",
        "nama": "X DKV 1",
        "tingkat": "X",
        "jurusan": "Desain Komunikasi Visual",
        "tahunAjaran": "2024/2025"
    }
]
```

---

## 3. Get Pengumuman
- **Endpoint**: GET /pengumuman
- **Deskripsi**: Mendapatkan daftar pengumuman yang relevan bagi pengguna yang sedang login.
- **Akses**: Semua Role

**Headers:**

| Key | Value |
| :--- | :--- |
| Authorization | Bearer <token> |

**Response 200 (Sukses):**
```json
[
    {
        "_id": "...",
        "judul": "Lomba Desain Poster Kemerdekaan",
        "isi": "Diberitahukan kepada seluruh siswa...",
        "pembuat": {
            "_id": "...",
            "name": "Super Admin",
            "role": "super_admin"
        },
        "targetRole": "siswa",
        "createdAt": "..."
    }
]
```

