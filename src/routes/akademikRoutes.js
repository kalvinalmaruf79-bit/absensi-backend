// src/routes/akademikRoutes.js
const express = require("express");
const router = express.Router();

const {
  generateRaporSiswa,
  generateTranskripSiswa,
} = require("../controllers/akademikController");

const {
  authMiddleware,
  verifyAdminOrGuru, // Wali kelas atau admin bisa generate
  verifySiswa, // Siswa bisa melihat miliknya sendiri
  checkUserActive,
} = require("../middleware/authMiddleware");

// Rute untuk Admin atau Guru (Wali Kelas) untuk men-generate rapor siswa tertentu
router.get(
  "/rapor/:siswaId",
  authMiddleware,
  verifyAdminOrGuru,
  checkUserActive,
  generateRaporSiswa
);

// Rute untuk siswa melihat rapornya sendiri
router.get(
  "/rapor-saya",
  authMiddleware,
  verifySiswa,
  checkUserActive,
  (req, res, next) => {
    // Teruskan ID siswa dari user yang login ke controller
    req.params.siswaId = req.user.id;
    next();
  },
  generateRaporSiswa
);

// Rute untuk Admin atau Guru (Wali Kelas) untuk men-generate transkrip siswa tertentu
router.get(
  "/transkrip/:siswaId",
  authMiddleware,
  verifyAdminOrGuru,
  checkUserActive,
  generateTranskripSiswa
);

// Rute untuk siswa melihat transkripnya sendiri
router.get(
  "/transkrip-saya",
  authMiddleware,
  verifySiswa,
  checkUserActive,
  (req, res, next) => {
    // Teruskan ID siswa dari user yang login ke controller
    req.params.siswaId = req.user.id;
    next();
  },
  generateTranskripSiswa
);

module.exports = router;
