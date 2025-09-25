// routes/absensiRoutes.js (Updated)
const express = require("express");
const router = express.Router();

const {
  checkIn,
  getRiwayatAbsensi,
  updateKeteranganPresensi,
  exportAbsensi,
} = require("../controllers/absensiController");
const {
  authMiddleware,
  verifyAdminOrGuru,
  verifySiswa,
} = require("../middleware/authMiddleware");

// Impor rute pengajuan yang baru
const pengajuanRoutes = require("./pengajuanAbsensiRoutes");

// Siswa check-in
router.post("/check-in", authMiddleware, verifySiswa, checkIn);

// Gunakan rute pengajuan dengan prefix '/pengajuan'
// Sehingga endpoint-nya menjadi /api/absensi/pengajuan/...
router.use("/pengajuan", pengajuanRoutes);

// Admin/Guru management
router.get("/riwayat", authMiddleware, verifyAdminOrGuru, getRiwayatAbsensi);
router.put("/:id", authMiddleware, verifyAdminOrGuru, updateKeteranganPresensi);
router.get("/export", authMiddleware, verifyAdminOrGuru, exportAbsensi);

module.exports = router;
