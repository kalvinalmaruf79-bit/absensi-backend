// routes/commonRoutes.js (Routes yang bisa diakses semua user)
const express = require("express");
const router = express.Router();

const MataPelajaran = require("../models/MataPelajaran");
const Kelas = require("../models/Kelas");
const {
  authMiddleware,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

// Get semua mata pelajaran (untuk dropdown, etc)
router.get(
  "/mata-pelajaran",
  authMiddleware,
  verifyAnyUser,
  async (req, res) => {
    try {
      const mataPelajaran = await MataPelajaran.find({ isActive: true })
        .select("nama kode")
        .sort({ nama: 1 });
      res.json(mataPelajaran);
    } catch (error) {
      res.status(500).json({ message: "Error getting mata pelajaran" });
    }
  }
);

// Get semua kelas (untuk dropdown, etc)
router.get("/kelas", authMiddleware, verifyAnyUser, async (req, res) => {
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
