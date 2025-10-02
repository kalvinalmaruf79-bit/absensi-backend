# 📘 Modul Autentikasi

Endpoint yang berhubungan dengan proses autentikasi pengguna, profil, dan manajemen akun.  

---

## 1. Login Pengguna  

- **Endpoint**: `POST /auth/login`  
- **Deskripsi**: Mengautentikasi pengguna (siswa, guru, atau super admin) dan mengembalikan token JWT jika berhasil.  
- **Akses**: Publik  

### Request Body
```json
{
  "identifier": "superadmin",
  "password": "password123"
}
```

| Field      | Tipe   | Deskripsi                                                                 |
|------------|--------|---------------------------------------------------------------------------|
| identifier | String | Wajib. NIS untuk siswa, NIP untuk guru, atau `superadmin` untuk admin     |
| password   | String | Wajib. Password pengguna                                                  |

### Response (200)
```json
{
  "message": "Login berhasil",
  "token": "jwt_token_di_sini",
  "user": {
    "id": "123",
    "role": "superadmin",
    "name": "Super Admin",
    "isPasswordDefault": true
  }
}
```

> `isPasswordDefault` menunjukkan apakah pengguna masih menggunakan password default (misal: sama dengan NIP/NIS) dan perlu diarahkan untuk mengganti password.  

### Response (400/401)
```json
{
  "message": "Identifier atau password salah"
}
```

---

## 2. Profil Pengguna  

- **Endpoint**: `GET /auth/profile`  
- **Deskripsi**: Mengambil data profil lengkap pengguna yang sedang login berdasarkan token JWT.  
- **Akses**: Semua Role (Login diperlukan)  

### Headers
```
Authorization: Bearer <jwt_token>
```

### Response (200)
```json
{
  "_id": "60d0fe4f5311236168a109dd",
  "name": "Budi Santoso",
  "email": "budi.santoso@sekolah.com",
  "identifier": "G2024001",
  "role": "guru",
  "isActive": true,
  "isPasswordDefault": false,
  "mataPelajaran": [
    {
      "_id": "60d0fe4f5311236168a109de",
      "nama": "Dasar Desain Grafis",
      "kode": "DKV-X-01"
    }
  ]
}
```

---

## 3. Ganti Password  

- **Endpoint**: `PUT /auth/change-password`  
- **Deskripsi**: Memperbarui password pengguna yang sedang login.  
- **Akses**: Semua Role (Login diperlukan)  

### Headers
```
Authorization: Bearer <jwt_token>
```

### Request Body
```json
{
  "oldPassword": "password_lama",
  "newPassword": "password_baru_yang_kuat"
}
```

### Response (200)
```json
{
  "message": "Password berhasil diganti"
}
```

---

## 4. Lupa Password & Reset  

### 4.1 Kirim Link Reset Password  

- **Endpoint**: `POST /auth/forgot-password`  
- **Deskripsi**: Mengirimkan link unik untuk reset password ke email pengguna.  
- **Akses**: Publik  

#### Request Body
```json
{
  "email": "user@sekolah.com"
}
```

#### Response (200)
```json
{
  "message": "Jika email terdaftar, link reset akan dikirim."
}
```

---

### 4.2 Verifikasi Token Reset  

- **Endpoint**: `GET /auth/reset-password/:token`  
- **Deskripsi**: Memverifikasi apakah token reset valid dan belum kedaluwarsa.  
- **Akses**: Publik  

#### Response (200)
```json
{
  "message": "Token valid."
}
```

#### Response (400)
```json
{
  "message": "Token reset tidak valid atau sudah kedaluwarsa."
}
```

---

### 4.3 Set Password Baru  

- **Endpoint**: `PUT /auth/reset-password/:token`  
- **Deskripsi**: Mengatur password baru menggunakan token yang valid.  
- **Akses**: Publik  

#### Request Body
```json
{
  "password": "password_baru_yang_kuat"
}
```

#### Response (200)
```json
{
  "message": "Password berhasil direset."
}
```

---

## 5. Registrasi Perangkat (Push Notification)  

- **Endpoint**: `POST /auth/register-device`  
- **Deskripsi**: Mendaftarkan token perangkat (OneSignal Player ID) ke data pengguna untuk menerima push notification.  
- **Akses**: Semua Role (Login diperlukan)  

### Headers
```
Authorization: Bearer <jwt_token>
```

### Request Body
```json
{
  "deviceToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Response (200)
```json
{
  "message": "Perangkat berhasil didaftarkan."
}
```

