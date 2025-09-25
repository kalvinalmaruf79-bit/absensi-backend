// src/routes/waliKelasRoutes.js
const express = require("express");
const router = express.Router();

const {
  authMiddleware,
  verifyGuru,
  verifyWaliKelas, // Impor middleware baru
} = require("../middleware/authMiddleware");

const { getSiswaWaliKelas } = require("../controllers/guruController");

const {
  getAllPengajuan,
  reviewPengajuan,
} = require("../controllers/pengajuanAbsensiController");

// Semua rute di sini memerlukan akses sebagai Guru
// dan harus merupakan Wali Kelas yang aktif
router.use(authMiddleware, verifyGuru, verifyWaliKelas);

// Rute untuk mendapatkan daftar siswa yang berada di bawah perwalian guru yang login
router.get("/siswa", getSiswaWaliKelas);

// Rute untuk melihat pengajuan absensi dari siswa perwalian
router.get("/pengajuan-absensi", getAllPengajuan);

// Rute untuk meninjau (menyetujui/menolak) pengajuan absensi
router.put("/pengajuan-absensi/:id/review", reviewPengajuan);

module.exports = router;
