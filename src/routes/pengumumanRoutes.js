const express = require("express");
const router = express.Router();

const {
  createPengumuman,
  getPengumuman,
  getPengumumanById,
  updatePengumuman,
  deletePengumuman,
  togglePublishPengumuman,
} = require("../controllers/pengumumanController");
const {
  authMiddleware,
  verifyAdminOrGuru,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

// =================================================================
// RUTE UNTUK ADMIN DAN GURU (Manajemen Pengumuman)
// =================================================================

// POST /api/pengumuman - Membuat pengumuman baru
router.post("/", authMiddleware, verifyAdminOrGuru, createPengumuman);

// PUT /api/pengumuman/:id - Mengupdate pengumuman
router.put("/:id", authMiddleware, verifyAdminOrGuru, updatePengumuman);

// DELETE /api/pengumuman/:id - Menghapus pengumuman
router.delete("/:id", authMiddleware, verifyAdminOrGuru, deletePengumuman);

// PATCH /api/pengumuman/:id/toggle-publish - Mengubah status publikasi
router.patch(
  "/:id/toggle-publish",
  authMiddleware,
  verifyAdminOrGuru,
  togglePublishPengumuman
);

// =================================================================
// RUTE UNTUK SEMUA USER YANG TERAUTENTIKASI
// =================================================================

// GET /api/pengumuman - Mendapatkan semua pengumuman yang relevan
router.get("/", authMiddleware, verifyAnyUser, getPengumuman);

// GET /api/pengumuman/:id - Mendapatkan detail satu pengumuman
router.get("/:id", authMiddleware, verifyAnyUser, getPengumumanById);

module.exports = router;
