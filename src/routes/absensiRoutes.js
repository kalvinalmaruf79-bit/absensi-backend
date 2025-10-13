// routes/absensiRoutes.js
const express = require("express");
const router = express.Router();
const {
  checkIn,
  checkInWithCode,
  getRiwayatAbsensi,
  updateKeteranganPresensi,
  exportAbsensi,
  createManualAbsensi,
} = require("../controllers/absensiController");
const {
  authMiddleware,
  verifyAdminOrGuru,
  verifySiswa,
} = require("../middleware/authMiddleware");

// Impor rute pengajuan
const pengajuanRoutes = require("./pengajuanAbsensiRoutes");

// ========== SISWA CHECK-IN ROUTES ==========

// Check-in via QR Code (dengan lokasi)
// Endpoint: POST /api/absensi/check-in
router.post("/check-in", authMiddleware, verifySiswa, checkIn);

// Check-in via Manual Code (tanpa QR scan, siswa ketik kode)
// Endpoint: POST /api/absensi/check-in-code
router.post("/check-in-code", authMiddleware, verifySiswa, checkInWithCode);

// ========== PENGAJUAN ROUTES ==========

// Gunakan rute pengajuan dengan prefix '/pengajuan'
// Endpoint-nya menjadi /api/absensi/pengajuan/...
router.use("/pengajuan", pengajuanRoutes);

// ========== GURU/ADMIN MANAGEMENT ROUTES ==========

// Get riwayat absensi
// Endpoint: GET /api/absensi/riwayat
router.get("/riwayat", authMiddleware, verifyAdminOrGuru, getRiwayatAbsensi);

// Update keterangan presensi (hadir/izin/sakit/alpa)
// Endpoint: PUT /api/absensi/:id
router.put("/:id", authMiddleware, verifyAdminOrGuru, updateKeteranganPresensi);

// Export absensi ke Excel
// Endpoint: GET /api/absensi/export
router.get("/export", authMiddleware, verifyAdminOrGuru, exportAbsensi);

// Create manual absensi (Guru/Admin input langsung)
// Endpoint: POST /api/absensi/manual
router.post("/manual", authMiddleware, verifyAdminOrGuru, createManualAbsensi);

module.exports = router;
