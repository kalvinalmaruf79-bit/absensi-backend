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
  forceDeleteMataPelajaran,
  restoreMataPelajaran,
  getMataPelajaranStats,
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
  getJadwalStats, // TAMBAHAN
  updateJadwal,
  deleteJadwal,
  forceDeleteJadwal, // TAMBAHAN
  restoreJadwal, // TAMBAHAN
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

// ============= DASHBOARD =============
router.get("/dashboard", getDashboard);

// ============= SETTINGS MANAGEMENT =============
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

// ============= REPORTS MANAGEMENT =============
router.get("/reports/activity", getActivityReport);

// ============= USER MANAGEMENT =============
router.post("/users/guru", createGuru);
router.post("/users/siswa", createSiswa);
router.post("/users/import", excelUploader.single("file"), importUsers);
router.get("/users", getAllUsers);
router.put("/users/:id/reset-password", resetPassword);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// ============= ACADEMIC CYCLE MANAGEMENT =============
router.get("/academic/promotion-recommendation", getPromotionRecommendation);
router.post("/academic/promote", processPromotion);

// ============= MATA PELAJARAN MANAGEMENT =============
router.get("/mata-pelajaran", getAllMataPelajaran);
router.post("/mata-pelajaran", createMataPelajaran);
router.put("/mata-pelajaran/assign-guru", assignGuruMataPelajaran);
router.put("/mata-pelajaran/unassign-guru", unassignGuruMataPelajaran);

// Routes spesifik HARUS DI ATAS :id
router.get("/mata-pelajaran/:id/stats", getMataPelajaranStats);
router.put("/mata-pelajaran/:id/restore", restoreMataPelajaran);
router.delete("/mata-pelajaran/:id/force", forceDeleteMataPelajaran);

// Routes dengan :id
router.get("/mata-pelajaran/:id", getMataPelajaranById);
router.put("/mata-pelajaran/:id", updateMataPelajaran);
router.delete("/mata-pelajaran/:id", deleteMataPelajaran);

// ============= KELAS MANAGEMENT =============
router.get("/kelas", getAllKelas);
router.post("/kelas", createKelas);

// Routes spesifik HARUS DI ATAS :id
router.get("/kelas/:id/stats", getKelasStats);
router.put("/kelas/:id/restore", restoreKelas);
router.delete("/kelas/:id/force", forceDeleteKelas);

// Routes dengan :id
router.get("/kelas/:id", getKelasById);
router.put("/kelas/:id", updateKelas);
router.delete("/kelas/:id", deleteKelas);

// ============= JADWAL MANAGEMENT =============
router.get("/jadwal", getAllJadwal);
router.post("/jadwal", createJadwal);

// Routes spesifik HARUS DI ATAS :id
router.get("/jadwal/:id/stats", getJadwalStats);
router.put("/jadwal/:id/restore", restoreJadwal);
router.delete("/jadwal/:id/force", forceDeleteJadwal);

// Routes dengan :id
router.put("/jadwal/:id", updateJadwal);
router.delete("/jadwal/:id", deleteJadwal);

module.exports = router;
