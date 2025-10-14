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
  getMataPelajaranSiswa,
  getStatistikNilai,
  getRingkasanNilai,
  // TAMBAHKAN import fungsi presensi
  getRiwayatPresensi,
  getStatistikPresensi,
  getPresensiHariIni,
  getDetailPresensi,
} = require("../controllers/siswaController");

const {
  authMiddleware,
  verifySiswa,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Middleware ini akan melindungi semua rute siswa
router.use(authMiddleware, verifySiswa, checkUserActive);

// ========== DASHBOARD & JADWAL ==========
router.get("/dashboard", getDashboard);
router.get("/jadwal", getJadwalSiswa);
router.get("/jadwal/mendatang", getJadwalMendatang);

// ========== TUGAS ==========
router.get("/tugas/mendatang", getTugasMendatang);

// ========== NILAI ==========
// PENTING: Route spesifik harus di atas route dengan parameter
router.get("/nilai/statistik", getStatistikNilai);
router.get("/nilai/ringkasan", getRingkasanNilai);
router.get("/nilai", getNilaiSiswa);

// ========== PRESENSI (BARU) ==========
// Route spesifik harus di atas route dengan parameter
router.get("/presensi/statistik", getStatistikPresensi);
router.get("/presensi/hari-ini", getPresensiHariIni);
router.get("/presensi/:id", getDetailPresensi);
router.get("/presensi", getRiwayatPresensi); // Route utama untuk list

// ========== LAINNYA ==========
router.get("/teman-sekelas", getTemanSekelas);
router.get("/mata-pelajaran", getMataPelajaranSiswa);
router.get("/notifikasi", getNotifikasi);
router.patch("/notifikasi/:id/read", markNotifikasiAsRead);
router.get("/histori-aktivitas", getHistoriAktivitas);

module.exports = router;
