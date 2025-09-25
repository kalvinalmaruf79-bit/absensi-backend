// routes/siswaRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getJadwalSiswa,
  getNilaiSiswa,
  getRiwayatPresensi,
  getTemanSekelas,
  getNotifikasi,
  markNotifikasiAsRead,
  getJadwalMendatang,
  getTugasMendatang, // Impor fungsi baru
} = require("../controllers/siswaController");

const {
  authMiddleware,
  verifySiswa,
  checkUserActive,
} = require("../middleware/authMiddleware");

router.use(authMiddleware, verifySiswa, checkUserActive);

// Dashboard & Profile
router.get("/dashboard", getDashboard);

// Notifikasi
router.get("/notifikasi", getNotifikasi);
router.patch("/notifikasi/:id/read", markNotifikasiAsRead);

// Jadwal
router.get("/jadwal", getJadwalSiswa);
router.get("/jadwal/mendatang", getJadwalMendatang);

// --- RUTE BARU UNTUK TUGAS MENDATANG ---
router.get("/tugas/mendatang", getTugasMendatang);
// ------------------------------------

// Nilai
router.get("/nilai", getNilaiSiswa);

// Presensi
router.get("/presensi", getRiwayatPresensi);

// Teman Sekelas
router.get("/teman-sekelas", getTemanSekelas);

module.exports = router;
