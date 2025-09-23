// routes/siswaRoutes.js
const express = require("express");
const router = express.Router();

// Import semua function yang dibutuhkan
const {
  getDashboard,
  getJadwalSiswa,
  getNilaiSiswa,
  getRiwayatPresensi,
  getTemanSekelas,
} = require("../controllers/siswaController");

const {
  authMiddleware,
  verifySiswa,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Semua route memerlukan Siswa access
router.use(authMiddleware, verifySiswa, checkUserActive);

// Dashboard & Profile
router.get("/dashboard", getDashboard);

// Jadwal
router.get("/jadwal", getJadwalSiswa);

// Nilai
router.get("/nilai", getNilaiSiswa);

// Presensi
router.get("/presensi", getRiwayatPresensi);

// Teman Sekelas
router.get("/teman-sekelas", getTemanSekelas);

module.exports = router;
