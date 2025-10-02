// src/routes/superAdminRoutes.js
const express = require("express");
const router = express.Router();
const createUploader = require("../middleware/uploadMiddleware");

const {
  getDashboard,
  getSettings,
  updateSettings,
  createGuru,
  createSiswa,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetPassword,
  importUsers,
  getActivityReport,
  getPromotionRecommendation,
  processPromotion,
  createMataPelajaran,
  getAllMataPelajaran,
  getMataPelajaranById,
  updateMataPelajaran,
  deleteMataPelajaran,
  assignGuruMataPelajaran,
  unassignGuruMataPelajaran,
  createKelas,
  getAllKelas,
  getKelasById,
  updateKelas,
  deleteKelas,
  forceDeleteKelas, // TAMBAHAN BARU
  restoreKelas, // TAMBAHAN BARU
  getKelasStats, // TAMBAHAN BARU
  createJadwal,
  getAllJadwal,
  updateJadwal,
  deleteJadwal,
} = require("../controllers/superAdminController");

const {
  authMiddleware,
  verifySuperAdmin,
  checkUserActive,
} = require("../middleware/authMiddleware");

// PERBAIKAN: Memanggil createUploader dengan argumen yang benar
const excelUploader = createUploader(5, [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // MIME type untuk .xlsx
]);

router.use(authMiddleware, verifySuperAdmin, checkUserActive);

// Dashboard
router.get("/dashboard", getDashboard);

// Settings Management
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

// Reports Management
router.get("/reports/activity", getActivityReport);

// User Management
router.post("/users/guru", createGuru);
router.post("/users/siswa", createSiswa);
router.post("/users/import", excelUploader.single("file"), importUsers);
router.get("/users", getAllUsers);
router.put("/users/:id/reset-password", resetPassword);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Academic Cycle Management
router.get("/academic/promotion-recommendation", getPromotionRecommendation);
router.post("/academic/promote", processPromotion);

// Mata Pelajaran Management
router.post("/mata-pelajaran", createMataPelajaran);
router.get("/mata-pelajaran", getAllMataPelajaran);
router.put("/mata-pelajaran/assign-guru", assignGuruMataPelajaran);
router.put("/mata-pelajaran/unassign-guru", unassignGuruMataPelajaran);
router.get("/mata-pelajaran/:id", getMataPelajaranById);
router.put("/mata-pelajaran/:id", updateMataPelajaran);
router.delete("/mata-pelajaran/:id", deleteMataPelajaran);

// Kelas Management
// Get all kelas (with optional includeInactive)
router.get("/kelas", getAllKelas);
// Get kelas stats (detail info sebelum delete) - HARUS DI ATAS :id route
router.get("/kelas/:id/stats", getKelasStats);
// Get kelas by id
router.get("/kelas/:id", getKelasById);
// Create kelas
router.post("/kelas", createKelas);
// Update kelas
router.put("/kelas/:id", updateKelas);
// Restore kelas (aktifkan kembali)
router.put("/kelas/:id/restore", restoreKelas);
// Soft delete kelas (nonaktifkan)
router.delete("/kelas/:id", deleteKelas);
// Force delete kelas (hapus permanen) - HARUS DI BAWAH route /kelas/:id
router.delete("/kelas/:id/force", forceDeleteKelas);

// Jadwal Management
router.post("/jadwal", createJadwal);
router.get("/jadwal", getAllJadwal);
router.put("/jadwal/:id", updateJadwal);
router.delete("/jadwal/:id", deleteJadwal);

module.exports = router;
