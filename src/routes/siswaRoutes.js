// src/routes/siswaRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getJadwalSiswa,
  getNilaiSiswa,
  getTemanSekelas,
  getNotifikasi,
  markNotifikasiAsRead,
  getJadwalMendatang,
  getTugasMendatang,
  getHistoriAktivitas,
} = require("../controllers/siswaController");

const {
  authMiddleware,
  verifySiswa,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Middleware ini akan melindungi semua rute siswa
router.use(authMiddleware, verifySiswa, checkUserActive);

// Rute-rute utama sesuai dengan Flutter Service Anda
router.get("/dashboard", getDashboard);
router.get("/jadwal", getJadwalSiswa);
router.get("/jadwal/mendatang", getJadwalMendatang);
router.get("/tugas/mendatang", getTugasMendatang);
router.get("/nilai", getNilaiSiswa);
router.get("/teman-sekelas", getTemanSekelas);
router.get("/notifikasi", getNotifikasi);
router.patch("/notifikasi/:id/read", markNotifikasiAsRead); // Mendukung 'all' atau ID spesifik
router.get("/histori-aktivitas", getHistoriAktivitas);

module.exports = router;
