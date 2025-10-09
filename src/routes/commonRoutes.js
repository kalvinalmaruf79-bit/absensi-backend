// src/routes/commonRoutes.js
const express = require("express");
const router = express.Router();

const MataPelajaran = require("../models/MataPelajaran");
const Kelas = require("../models/Kelas");
const {
  getGlobalSettings,
  getSiswaAcademicHistory,
} = require("../controllers/commonController"); // <-- IMPOR FUNGSI BARU
const {
  authMiddleware,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

// Middleware ini akan melindungi semua rute di bawah ini
router.use(authMiddleware, verifyAnyUser);

// --- RUTE BARU UNTUK PENGATURAN GLOBAL & RIWAYAT AKADEMIK ---
// Endpoint untuk mendapatkan Tahun Ajaran & Semester Aktif
router.get("/settings", getGlobalSettings);

// Endpoint khusus siswa untuk mendapatkan riwayat semester & tahun ajaran
router.get("/academic-history", getSiswaAcademicHistory);
// ----------------------------------------------------------------

// Get semua mata pelajaran (untuk dropdown, etc)
router.get("/mata-pelajaran", async (req, res) => {
  try {
    const mataPelajaran = await MataPelajaran.find({ isActive: true })
      .select("nama kode")
      .sort({ nama: 1 });
    res.json(mataPelajaran);
  } catch (error) {
    res.status(500).json({ message: "Error getting mata pelajaran" });
  }
});

// Get semua kelas (untuk dropdown, etc)
router.get("/kelas", async (req, res) => {
  try {
    const kelas = await Kelas.find({ isActive: true })
      .select("nama tingkat jurusan tahunAjaran")
      .sort({ tingkat: 1, nama: 1 });
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: "Error getting kelas" });
  }
});

module.exports = router;
