// src/routes/pengajuanAbsensiRoutes.js
const express = require("express");
const router = express.Router();
const createUploader = require("../middleware/uploadMiddleware");

const {
  createPengajuan,
  getPengajuanSiswa,
  getAllPengajuan,
  reviewPengajuan,
} = require("../controllers/pengajuanAbsensiController");

const {
  authMiddleware,
  verifySiswa,
  verifyAdminOrGuru,
} = require("../middleware/authMiddleware");

// Inisialisasi uploader khusus untuk bukti izin/sakit
const buktiUploader = createUploader("bukti-absensi", 10, /pdf|jpg|jpeg|png/); // Maks 10MB, format gambar & PDF

// === RUTE SISWA ===
// Membuat pengajuan baru
router.post(
  "/",
  authMiddleware,
  verifySiswa,
  buktiUploader.single("fileBukti"),
  createPengajuan
);

// Melihat riwayat pengajuan sendiri
router.get("/riwayat-saya", authMiddleware, verifySiswa, getPengajuanSiswa);

// === RUTE GURU & ADMIN ===
// Melihat semua pengajuan
router.get("/", authMiddleware, verifyAdminOrGuru, getAllPengajuan);

// Menyetujui atau menolak pengajuan
router.put("/:id/review", authMiddleware, verifyAdminOrGuru, reviewPengajuan);

module.exports = router;
