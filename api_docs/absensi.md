# Modul Absensi & QR Code

Endpoint untuk manajemen presensi, pengajuan izin, dan pembuatan QR code.

---

## 1. Guru: Generate QR Code Sesi Presensi

- **Endpoint**: `POST /qr/generate`  
- **Deskripsi**: Membuat sesi presensi baru dan menghasilkan QR code yang valid selama 30 menit.  
- **Akses**: Guru  

**Headers:**

| Key           | Value              |
| :------------ | :----------------- |
| Authorization | Bearer <token>     |

**Request Body:**
```json
{
    "jadwalId": "60d0fe4f5311236168a109e2",
    "latitude": -7.7956,
    "longitude": 110.3695
}
```

**Response 201 (Created):**
```json
{
    "message": "QR Code berhasil dibuat.",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
    "kodeUnik": "A1B2C3",
    "expiredAt": "2025-09-29T10:30:00.000Z",
    "jadwal": {
        "mataPelajaran": "Dasar Desain Grafis",
        "kelas": "X DKV 1"
    }
}
```

---

## 2. Siswa: Check-in (Presensi)

- **Endpoint**: `POST /absensi/check-in`  
- **Deskripsi**: Siswa melakukan presensi dengan mengirimkan kode sesi dan lokasi geografis.  
- **Akses**: Siswa  

**Headers:**

| Key           | Value              |
| :------------ | :----------------- |
| Authorization | Bearer <token>     |

**Request Body:**
```json
{
    "kodeSesi": "A1B2C3",
    "latitude": -7.7957,
    "longitude": 110.3694
}
```

**Response 200 (Sukses):**
```json
{
    "message": "Presensi berhasil!"
}
```

**Response 400 (Gagal):**
```json
{
    "message": "Kode sesi tidak valid atau sudah kedaluwarsa!"
}
```

**Response 403 (Gagal):**
```json
{
    "message": "Anda berada di luar radius yang diizinkan! Jarak Anda 150 meter."
}
```

---

## 3. Siswa: Membuat Pengajuan Izin/Sakit

- **Endpoint**: `POST /absensi/pengajuan`  
- **Deskripsi**: Siswa membuat pengajuan tidak hadir (izin atau sakit) dengan melampirkan file bukti jika ada.  
- **Akses**: Siswa  

**Headers:**

| Key           | Value                  |
| :------------ | :--------------------- |
| Authorization | Bearer <token>         |
| Content-Type  | multipart/form-data    |

**Request Body (form-data):**

| Key       | Tipe   | Deskripsi |
| :-------- | :----- | :-------- |
| tanggal   | String | Wajib. Format YYYY-MM-DD. |
| keterangan| String | Wajib. izin atau sakit. |
| alasan    | String | Wajib. Deskripsi alasan tidak hadir. |
| jadwalIds | String | Wajib. JSON string dari array ID jadwal yang terpengaruh, misal: `["jadwalId1", "jadwalId2"]`. |
| fileBukti | File   | Opsional. Surat dokter atau bukti lainnya. |

**Response 201 (Created):**
```json
{
    "message": "Pengajuan berhasil dikirim.",
    "data": {
        // ... detail pengajuan
    }
}
```

---

## 4. Wali Kelas: Meninjau Pengajuan Absensi

- **Endpoint**: `PUT /guru/wali-kelas/pengajuan-absensi/:id/review`  
- **Deskripsi**: Wali kelas menyetujui atau menolak pengajuan absensi dari siswa perwaliannya.  
- **Akses**: Guru (yang berstatus Wali Kelas)  

**Headers:**

| Key           | Value              |
| :------------ | :----------------- |
| Authorization | Bearer <token>     |

**URL Params:**

| Parameter | Tipe   | Deskripsi |
| :-------- | :----- | :-------- |
| id        | String | Wajib. ID dari pengajuan absensi. |

**Request Body:**
```json
{
    "status": "disetujui"
}
```
> Nilai status bisa **disetujui** atau **ditolak**.

**Response 200 (Sukses):**
```json
{
    "message": "Pengajuan berhasil di-disetujui.",
    "data": {
        // ... detail pengajuan yang sudah diupdate
    }
}
```

