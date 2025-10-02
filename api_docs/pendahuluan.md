# Dokumentasi API Sistem Akademik Sekolah
=======================================

Selamat datang di dokumentasi API Sistem Akademik Sekolah. Dokumen ini bertujuan untuk memandu developer frontend dalam mengintegrasikan aplikasi dengan backend.

## Base URL

Semua endpoint yang ada di dalam dokumentasi ini menggunakan base URL berikut:

```
https://your-api-domain.com/api
```

Pastikan untuk mengganti `your-api-domain.com` dengan domain production atau `http://localhost:3000/api` untuk pengembangan lokal.

## Autentikasi

Hampir semua endpoint memerlukan autentikasi menggunakan **JSON Web Token (JWT)**. Token ini harus dikirimkan pada setiap request di dalam header `Authorization` dengan skema `Bearer`.

**Contoh Header:**

```
Authorization: Bearer <token_jwt_anda>
```

Token diperoleh dari endpoint:
- **POST** `/auth/login`

## Struktur Dokumentasi

Dokumentasi ini dipecah menjadi beberapa bagian berdasarkan peran (role) dan fungsionalitas:

1. **Pendahuluan**: Informasi umum (file ini).
2. **Autentikasi**: Endpoint untuk login, profil, ganti password, dll.
3. **Super Admin**: Semua endpoint yang hanya bisa diakses oleh Super Admin.
4. **Guru**: Endpoint khusus untuk fungsionalitas Guru, termasuk manajemen nilai dan tugas.
5. **Siswa**: Endpoint khusus untuk fungsionalitas Siswa, seperti melihat jadwal dan nilai.
6. **Absensi & QR**: Endpoint terkait presensi, pengajuan izin, dan generate QR code.
7. **Akademik**: Endpoint untuk rapor dan transkrip.
8. **Fitur Umum**: Endpoint yang dapat diakses oleh beberapa atau semua role, seperti mendapatkan daftar kelas.

Silakan navigasi ke file yang sesuai untuk melihat detail setiap endpoint.

