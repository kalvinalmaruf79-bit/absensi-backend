// routes/superAdminRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  createGuru,
  createSiswa,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetPassword,
  processPromotion, // Tambahkan ini
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

router.use(authMiddleware, verifySuperAdmin, checkUserActive);

// Dashboard
router.get("/dashboard", getDashboard);

// User Management
router.post("/users/guru", createGuru);
router.post("/users/siswa", createSiswa);
router.get("/users", getAllUsers);
router.put("/users/:id/reset-password", resetPassword);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// --- PERUBAHAN DI SINI ---
// Academic Cycle Management (BARU)
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
router.post("/kelas", createKelas);
router.get("/kelas", getAllKelas);
router.get("/kelas/:id", getKelasById);
router.put("/kelas/:id", updateKelas);
router.delete("/kelas/:id", deleteKelas);

// Jadwal Management
router.post("/jadwal", createJadwal);
router.get("/jadwal", getAllJadwal);
router.put("/jadwal/:id", updateJadwal);
router.delete("/jadwal/:id", deleteJadwal);

module.exports = router;
