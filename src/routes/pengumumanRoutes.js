// src/routes/pengumumanRoutes.js
const express = require("express");
const router = express.Router();

const {
  createPengumuman,
  getPengumuman,
} = require("../controllers/pengumumanController");
const {
  authMiddleware,
  verifyAdminOrGuru,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

// Rute untuk membuat pengumuman (hanya admin/guru)
router.post("/", authMiddleware, verifyAdminOrGuru, createPengumuman);

// Rute untuk mendapatkan pengumuman (semua user)
router.get("/", authMiddleware, verifyAnyUser, getPengumuman);

module.exports = router;
