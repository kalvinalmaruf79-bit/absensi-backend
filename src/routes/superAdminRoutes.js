// routes/superAdminRoutes.js
const express = require("express");
const router = express.Router();

// Import individual functions untuk menghindari error undefined
const {
  getDashboard,
  createGuru,
  createSiswa,
  getAllUsers,
  updateUser,
  resetPassword,
  createMataPelajaran,
  getAllMataPelajaran,
  assignGuruMataPelajaran,
  createKelas,
  getAllKelas,
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

// Semua route memerlukan Super Admin access
router.use(authMiddleware, verifySuperAdmin, checkUserActive);

// Dashboard
router.get("/dashboard", getDashboard);

// User Management
router.post("/users/guru", createGuru);
router.post("/users/siswa", createSiswa);
router.get("/users", getAllUsers);
router.put("/users/:id", updateUser);
router.put("/users/:id/reset-password", resetPassword);

// Mata Pelajaran Management
router.post("/mata-pelajaran", createMataPelajaran);
router.get("/mata-pelajaran", getAllMataPelajaran);
router.put("/mata-pelajaran/assign-guru", assignGuruMataPelajaran);

// Kelas Management
router.post("/kelas", createKelas);
router.get("/kelas", getAllKelas);

// Jadwal Management
router.post("/jadwal", createJadwal);
router.get("/jadwal", getAllJadwal);
router.put("/jadwal/:id", updateJadwal);
router.delete("/jadwal/:id", deleteJadwal);

module.exports = router;
