// routes/authRoutes.js
const express = require("express");
const router = express.Router();

const {
  loginUser,
  getUserProfile,
  changePassword,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  registerDevice, // Impor fungsi baru
} = require("../controllers/authController");

const {
  authMiddleware,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Rute Publik
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);

router.get("/reset-password/:token", verifyResetToken);
router.put("/reset-password/:token", resetPassword);

// Rute Terproteksi
router.get("/profile", authMiddleware, checkUserActive, getUserProfile);
router.put("/change-password", authMiddleware, checkUserActive, changePassword);

// --- RUTE BARU UNTUK REGISTRASI PERANGKAT ---
router.post(
  "/register-device",
  authMiddleware,
  checkUserActive,
  registerDevice
);
// ------------------------------------------

module.exports = router;
