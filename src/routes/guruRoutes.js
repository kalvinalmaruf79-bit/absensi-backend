// routes/guruRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getKelasDiampu,
  getMataPelajaranDiampu,
  getJadwalGuru,
  getSiswaKelas,
  inputNilai,
  inputNilaiMassal,
  getNilaiSiswa,
  getDetailNilaiSiswa,
  exportNilai,
  updateNilai, // <-- IMPOR BARU
  deleteNilai, // <-- IMPOR BARU
  getNilaiStats, // <-- IMPOR BARU
  getAnalisisKinerjaSiswa,
  getAbsensiBySesi,
  getRekapNilaiKelas,
  getHistoriAktivitasSiswa,
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
router.get("/kelas", getKelasDiampu);
router.get("/mata-pelajaran", getMataPelajaranDiampu);

// Absensi Management
router.get("/absensi/sesi", getAbsensiBySesi);

// Siswa & Kelas Management
router.get("/kelas/:kelasId/siswa", getSiswaKelas);
router.get("/kelas/:kelasId/rekap-nilai", getRekapNilaiKelas);

// --- RUTE BARU UNTUK HISTORI AKTIVITAS SISWA ---
router.get("/siswa/:siswaId/histori-aktivitas", getHistoriAktivitasSiswa);
// ---------------------------------------------

// =======================================================
// Nilai Management
router.post("/nilai", inputNilai);
router.post("/nilai/bulk", inputNilaiMassal);
router.get("/nilai", getNilaiSiswa);

// --- RUTE BARU UNTUK STATISTIK, UPDATE, DAN DELETE ---
router.get("/nilai/stats", getNilaiStats); // Endpoint untuk statistik
router.put("/nilai/:id", ...updateNilai); // Endpoint untuk update satu nilai
router.delete("/nilai/:id", ...deleteNilai); // Endpoint untuk hapus satu nilai
// --------------------------------------------------

router.get("/nilai/siswa/:siswaId", getDetailNilaiSiswa);
router.get("/nilai/export", exportNilai);
// =======================================================

// Analisis Kinerja
router.get("/analisis-kinerja", getAnalisisKinerjaSiswa);

module.exports = router;
