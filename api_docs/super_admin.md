# Modul Super Admin
Endpoint yang hanya dapat diakses oleh pengguna dengan role **super_admin**.

---

## 1. Dashboard & Laporan

### 1.1 Get Dashboard Super Admin
- **Endpoint**: GET /super-admin/dashboard
- **Deskripsi**: Mendapatkan data statistik ringkas untuk halaman utama Super Admin.
- **Akses**: Super Admin

**Headers:**

| Key | Value |
| :--- | :--- |
| Authorization | Bearer <token> |

**Response 200 (Sukses):**
```json
{
    "message": "Dashboard Super Admin",
    "data": {
        "totalGuru": 15,
        "totalSiswa": 350,
        "totalPengguna": 366,
        "totalMataPelajaran": 25,
        "totalKelas": 12,
        "totalJadwal": 60
    }
}
```

### 1.2 Get Laporan Aktivitas Guru
- **Endpoint**: GET /super-admin/reports/activity
- **Deskripsi**: Menghasilkan laporan aktivitas guru (pembuatan materi, tugas, input nilai, dll.) dalam rentang waktu tertentu. Bisa diekspor ke Excel.
- **Akses**: Super Admin

**Headers:**

| Key | Value |
| :--- | :--- |
| Authorization | Bearer <token> |

**Query Params:**

| Parameter | Tipe | Deskripsi |
| :--- | :--- | :--- |
| startDate | String | Opsional. Tanggal mulai (YYYY-MM-DD). |
| endDate | String | Opsional. Tanggal selesai (YYYY-MM-DD). |
| export | Boolean | Opsional. Set true untuk mengunduh Excel. |

**Response 200 (Sukses - JSON):**
```json
[
    {
        "name": "Budi Santoso",
        "identifier": "G2024001",
        "email": "budi.dkv@sekolah.com",
        "totalMateri": 5,
        "totalTugas": 3,
        "totalInputNilai": 60,
        "totalSesiPresensi": 20
    }
]
```

Jika `export=true`, respons berupa file `.xlsx`.

---

## 2. Manajemen Pengguna (User Management)

### 2.1 Membuat Guru Baru
- **Endpoint**: POST /super-admin/users/guru
- **Deskripsi**: Menambahkan guru baru. Password default = NIP.
- **Akses**: Super Admin

**Request Body:**
```json
{
    "name": "Budi Santoso",
    "email": "budi.santoso@sekolah.com",
    "identifier": "G2024001"
}
```

**Response 201 (Created):**
```json
{
    "message": "Guru berhasil dibuat.",
    "guru": {
        "_id": "...",
        "name": "Budi Santoso",
        "email": "budi.santoso@sekolah.com",
        "identifier": "G2024001",
        "role": "guru",
        "isPasswordDefault": true
    }
}
```

### 2.2 Membuat Siswa Baru
- **Endpoint**: POST /super-admin/users/siswa

**Request Body:**
```json
{
    "name": "Rina Sari",
    "email": "rina.sari@email.com",
    "identifier": "S24001",
    "kelas": "60d0fe4f5311236168a109df",
    "password": "password123"
}
```

### 2.3 Impor Pengguna dari Excel
- **Endpoint**: POST /super-admin/users/import

**Headers:**
- Content-Type: multipart/form-data

**Request Body (form-data):**
- file: Excel (.xlsx) dengan kolom: nama, email, identifier, role, kelasNama (wajib untuk siswa).

**Response 200 (Sukses):**
```json
{
    "message": "Proses impor selesai.",
    "report": {
        "berhasil": 50,
        "gagal": 2,
        "errors": [
            "Baris 22: Kelas 'X RPL 9' tidak ditemukan."
        ]
    }
}
```

### 2.4 Get Semua Pengguna
- **Endpoint**: GET /super-admin/users
- **Query Params**: role (String), isActive (Boolean)

### 2.5 Update Pengguna
- **Endpoint**: PUT /super-admin/users/:id

**Request Body:**
```json
{
    "name": "Rina Sarianingsih",
    "email": "rina.sari@newemail.com",
    "isActive": true,
    "kelas": "60d0fe4f5311236168a109e0"
}
```

### 2.6 Reset Password Pengguna
- **Endpoint**: PUT /super-admin/users/:id/reset-password

**Response 200 (Sukses):**
```json
{
    "message": "Password berhasil direset ke identifier."
}
```

---

## 3. Manajemen Akademik Master

### 3.1 CRUD Mata Pelajaran
- **Endpoint**:
  - POST /super-admin/mata-pelajaran
  - GET /super-admin/mata-pelajaran
  - GET /super-admin/mata-pelajaran/:id
  - PUT /super-admin/mata-pelajaran/:id
  - DELETE /super-admin/mata-pelajaran/:id

### 3.2 Menugaskan Guru ke Mata Pelajaran
- **Endpoint**: PUT /super-admin/mata-pelajaran/assign-guru

**Request Body:**
```json
{
    "mataPelajaranId": "60d0fe4f5311236168a109de",
    "guruId": "60d0fe4f5311236168a109dd"
}
```

### 3.3 CRUD Kelas
- **Endpoint**:
  - POST /super-admin/kelas
  - GET /super-admin/kelas
  - GET /super-admin/kelas/:id
  - PUT /super-admin/kelas/:id
  - DELETE /super-admin/kelas/:id

### 3.4 CRUD Jadwal Pelajaran
- **Endpoint**:
  - POST /super-admin/jadwal
  - GET /super-admin/jadwal
  - PUT /super-admin/jadwal/:id
  - DELETE /super-admin/jadwal/:id

---

## 4. Siklus Akademik & Pengaturan

### 4.1 Get Rekomendasi Kenaikan Kelas
- **Endpoint**: GET /super-admin/academic/promotion-recommendation

**Query Params:**

| Parameter | Tipe | Deskripsi |
| :--- | :--- | :--- |
| kelasId | String | Wajib. ID kelas. |
| tahunAjaran | String | Wajib. Tahun ajaran. |

**Response 200 (Sukses):**
```json
{
    "rules": {
        "minAttendancePercentage": 80,
        "maxSubjectsBelowPassingGrade": 3,
        "passingGrade": 75
    },
    "recommendations": [
        {
            "siswaId": "...",
            "name": "Rina Sari",
            "identifier": "S24001",
            "rekap": {
                "attendancePercentage": "95.00",
                "subjectsBelowPassingGrade": 1
            },
            "systemRecommendation": "Naik Kelas",
            "reasons": [],
            "status": "Naik Kelas"
        }
    ]
}
```

### 4.2 Proses Kenaikan/Kelulusan Siswa
- **Endpoint**: POST /super-admin/academic/promote

**Request Body:**
```json
{
    "fromKelasId": "60d0fe4f5311236168a109df",
    "tahunAjaran": "2024/2025",
    "semester": "genap",
    "siswaData": [
        {
            "siswaId": "60d0fe4f5311236168a109e0",
            "status": "Naik Kelas",
            "toKelasId": "60d0fe4f5311236168a109f0"
        },
        {
            "siswaId": "60d0fe4f5311236168a109e1",
            "status": "Tinggal Kelas"
        }
    ]
}
```

### 4.3 Get & Update Pengaturan Aplikasi
- **Endpoint**:
  - GET /super-admin/settings
  - PUT /super-admin/settings

**Request Body (PUT):**
```json
{
    "namaSekolah": "SMK Hebat Jaya",
    "semesterAktif": "ganjil",
    "tahunAjaranAktif": "2024/2025"
}
```

