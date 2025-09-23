// routes/guruRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getJadwalGuru,
  getSiswaKelas,
  inputNilai,
  getNilaiSiswa,
  getDetailNilaiSiswa,
  exportNilai,
  getAnalisisKinerjaSiswa,
  getAbsensiBySesi, // Ditambahkan
  getSiswaWaliKelas, // Ditambahkan
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
router.get("/absensi/sesi", getAbsensiBySesi); // Rute baru

// Wali Kelas
router.get("/wali-kelas/siswa", getSiswaWaliKelas); // Rute baru

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
