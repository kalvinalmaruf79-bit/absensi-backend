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
  getTugasMendatang,
  getJadwalByTanggal,
  getHistoriAktivitas, // Impor fungsi baru
} = require("../controllers/siswaController");

const {
  authMiddleware,
  verifySiswa,
  checkUserActive,
} = require("../middleware/authMiddleware");

router.use(authMiddleware, verifySiswa, checkUserActive);

// Dashboard & Profile
router.get("/dashboard", getDashboard);
// --- RUTE BARU UNTUK HISTORI ---
router.get("/histori-aktivitas", getHistoriAktivitas);
// -------------------------------

// Notifikasi
router.get("/notifikasi", getNotifikasi);
router.patch("/notifikasi/:id/read", markNotifikasiAsRead);

// Jadwal
router.get("/jadwal", getJadwalSiswa);
router.get("/jadwal/mendatang", getJadwalMendatang);
router.get("/jadwal-by-tanggal", getJadwalByTanggal);

// Rute lainnya
router.get("/tugas/mendatang", getTugasMendatang);
router.get("/nilai", getNilaiSiswa);
router.get("/presensi", getRiwayatPresensi);
router.get("/teman-sekelas", getTemanSekelas);

module.exports = router;
