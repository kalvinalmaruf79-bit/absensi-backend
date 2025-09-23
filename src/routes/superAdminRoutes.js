// routes/superAdminRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  createGuru,
  createSiswa,
  getAllUsers,
  getUserById, // Ditambahkan
  updateUser,
  resetPassword,
  createMataPelajaran,
  getAllMataPelajaran,
  getMataPelajaranById, // Ditambahkan
  assignGuruMataPelajaran,
  createKelas,
  getAllKelas,
  getKelasById, // Ditambahkan
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
router.get("/users/:id", getUserById); // Rute baru
router.put("/users/:id", updateUser);
router.put("/users/:id/reset-password", resetPassword);

// Mata Pelajaran Management
router.post("/mata-pelajaran", createMataPelajaran);
router.get("/mata-pelajaran", getAllMataPelajaran);
router.get("/mata-pelajaran/:id", getMataPelajaranById); // Rute baru
router.put("/mata-pelajaran/assign-guru", assignGuruMataPelajaran);

// Kelas Management
router.post("/kelas", createKelas);
router.get("/kelas", getAllKelas);
router.get("/kelas/:id", getKelasById); // Rute baru

// Jadwal Management
router.post("/jadwal", createJadwal);
router.get("/jadwal", getAllJadwal);
router.put("/jadwal/:id", updateJadwal);
router.delete("/jadwal/:id", deleteJadwal);

module.exports = router;
