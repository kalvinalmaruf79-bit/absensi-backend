// routes/guruRoutes.js
const express = require("express");
const router = express.Router();

// Import semua function yang dibutuhkan
const {
  getDashboard,
  getJadwalGuru,
  getSiswaKelas,
  inputNilai,
  getNilaiSiswa,
  getDetailNilaiSiswa,
  exportNilai,
  getAnalisisKinerjaSiswa,
} = require("../controllers/guruController");

const {
  authMiddleware,
  verifyGuru,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Semua route memerlukan Guru access
router.use(authMiddleware, verifyGuru, checkUserActive);

// Dashboard & Profile
router.get("/dashboard", getDashboard);
router.get("/jadwal", getJadwalGuru);

// Siswa Management
router.get("/kelas/:kelasId/siswa", getSiswaKelas);

// Nilai Management
router.post("/nilai", inputNilai);
router.get("/nilai", getNilaiSiswa);
router.get("/nilai/siswa/:siswaId", getDetailNilaiSiswa);
router.get("/nilai/export", exportNilai);

// Analisis Kinerja
router.get("/analisis-kinerja", getAnalisisKinerjaSiswa);

module.exports = router;
