// routes/guruRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getJadwalGuru,
  getSiswaKelas,
  inputNilai,
  inputNilaiMassal,
  getNilaiSiswa,
  getDetailNilaiSiswa,
  exportNilai,
  getAnalisisKinerjaSiswa,
  getAbsensiBySesi,
  getRekapNilaiKelas, // Tambahkan fungsi baru
} = require("../controllers/guruController");

const {
  authMiddleware,
  verifyGuru,
  checkUserActive,
} = require("../middleware/authMiddleware");

const waliKelasRoutes = require("./waliKelasRoutes");

router.use(authMiddleware, verifyGuru, checkUserActive);

router.use("/wali-kelas", waliKelasRoutes);

// Dashboard & Profile
router.get("/dashboard", getDashboard);
router.get("/jadwal", getJadwalGuru);

// Absensi Management
router.get("/absensi/sesi", getAbsensiBySesi);

// Siswa & Kelas Management
router.get("/kelas/:kelasId/siswa", getSiswaKelas);
// --- RUTE BARU UNTUK REKAP NILAI ---
router.get("/kelas/:kelasId/rekap-nilai", getRekapNilaiKelas);
// ------------------------------------

// Nilai Management
router.post("/nilai", inputNilai);
router.post("/nilai/bulk", inputNilaiMassal);
router.get("/nilai", getNilaiSiswa);
router.get("/nilai/siswa/:siswaId", getDetailNilaiSiswa);
router.get("/nilai/export", exportNilai);

// Analisis Kinerja
router.get("/analisis-kinerja", getAnalisisKinerjaSiswa);

module.exports = router;
