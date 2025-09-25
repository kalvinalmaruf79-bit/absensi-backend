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
  // getSiswaWaliKelas, // Fungsi ini dipindahkan ke waliKelasRoutes
} = require("../controllers/guruController");

const {
  authMiddleware,
  verifyGuru,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Impor rute wali kelas yang baru
const waliKelasRoutes = require("./waliKelasRoutes");

router.use(authMiddleware, verifyGuru, checkUserActive);

// Gunakan rute wali kelas dengan prefix '/wali-kelas'
// Sehingga endpoint-nya menjadi /api/guru/wali-kelas/...
router.use("/wali-kelas", waliKelasRoutes);

// Dashboard & Profile
router.get("/dashboard", getDashboard);
router.get("/jadwal", getJadwalGuru);

// Absensi Management
router.get("/absensi/sesi", getAbsensiBySesi);

// Siswa Management
router.get("/kelas/:kelasId/siswa", getSiswaKelas);

// Nilai Management
router.post("/nilai", inputNilai);
router.post("/nilai/bulk", inputNilaiMassal); // Rute baru untuk input massal
router.get("/nilai", getNilaiSiswa);
router.get("/nilai/siswa/:siswaId", getDetailNilaiSiswa);
router.get("/nilai/export", exportNilai);

// Analisis Kinerja
router.get("/analisis-kinerja", getAnalisisKinerjaSiswa);

module.exports = router;
