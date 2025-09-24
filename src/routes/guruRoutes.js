// routes/guruRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getJadwalGuru,
  getSiswaKelas,
  inputNilai,
  inputNilaiMassal, // Tambahkan ini
  getNilaiSiswa,
  getDetailNilaiSiswa,
  exportNilai,
  getAnalisisKinerjaSiswa,
  getAbsensiBySesi,
  getSiswaWaliKelas,
} = require("../controllers/guruController");

const {
  authMiddleware,
  verifyGuru,
  checkUserActive,
} = require("../middleware/authMiddleware");

router.use(authMiddleware, verifyGuru, checkUserActive);

// Dashboard & Profile
router.get("/dashboard", getDashboard);
router.get("/jadwal", getJadwalGuru);

// Absensi Management
router.get("/absensi/sesi", getAbsensiBySesi);

// Wali Kelas
router.get("/wali-kelas/siswa", getSiswaWaliKelas);

// Siswa Management
router.get("/kelas/:kelasId/siswa", getSiswaKelas);

// --- PERUBAHAN DI SINI ---
// Nilai Management
router.post("/nilai", inputNilai);
router.post("/nilai/bulk", inputNilaiMassal); // Rute baru untuk input massal
router.get("/nilai", getNilaiSiswa);
router.get("/nilai/siswa/:siswaId", getDetailNilaiSiswa);
router.get("/nilai/export", exportNilai);

// Analisis Kinerja
router.get("/analisis-kinerja", getAnalisisKinerjaSiswa);

module.exports = router;
