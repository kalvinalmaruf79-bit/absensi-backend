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
  forceDeleteMataPelajaran, // TAMBAHAN BARU
  restoreMataPelajaran, // TAMBAHAN BARU
  getMataPelajaranStats, // TAMBAHAN BARU
  assignGuruMataPelajaran,
  unassignGuruMataPelajaran,
  createKelas,
  getAllKelas,
  getKelasById,
  updateKelas,
  deleteKelas,
  forceDeleteKelas,
  restoreKelas,
  getKelasStats,
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

const excelUploader = createUploader(5, [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
// Get all mata pelajaran
router.get("/mata-pelajaran", getAllMataPelajaran);
// Create mata pelajaran
router.post("/mata-pelajaran", createMataPelajaran);
// Assign/Unassign guru
router.put("/mata-pelajaran/assign-guru", assignGuruMataPelajaran);
router.put("/mata-pelajaran/unassign-guru", unassignGuruMataPelajaran);
// Get mata pelajaran stats (detail info sebelum delete) - HARUS DI ATAS :id route
router.get("/mata-pelajaran/:id/stats", getMataPelajaranStats);
// Get mata pelajaran by id
router.get("/mata-pelajaran/:id", getMataPelajaranById);
// Update mata pelajaran
router.put("/mata-pelajaran/:id", updateMataPelajaran);
// Restore mata pelajaran (aktifkan kembali)
router.put("/mata-pelajaran/:id/restore", restoreMataPelajaran);
// Soft delete mata pelajaran (nonaktifkan)
router.delete("/mata-pelajaran/:id", deleteMataPelajaran);
// Force delete mata pelajaran (hapus permanen) - HARUS DI BAWAH route :id
router.delete("/mata-pelajaran/:id/force", forceDeleteMataPelajaran);

// Kelas Management
router.get("/kelas", getAllKelas);
router.get("/kelas/:id/stats", getKelasStats);
router.get("/kelas/:id", getKelasById);
router.post("/kelas", createKelas);
router.put("/kelas/:id", updateKelas);
router.put("/kelas/:id/restore", restoreKelas);
router.delete("/kelas/:id", deleteKelas);
router.delete("/kelas/:id/force", forceDeleteKelas);

// Jadwal Management
router.post("/jadwal", createJadwal);
router.get("/jadwal", getAllJadwal);
router.put("/jadwal/:id", updateJadwal);
router.delete("/jadwal/:id", deleteJadwal);

module.exports = router;
