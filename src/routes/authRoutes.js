// routes/authRoutes.js
const express = require("express");
const router = express.Router();

const {
  loginUser,
  getUserProfile,
  changePassword,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  registerDevice,
} = require("../controllers/authController");

const {
  authMiddleware,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Rute Publik
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode); // Verifikasi kode
router.post("/reset-password", resetPassword); // Reset password dengan tempToken

// Rute Terproteksi
router.get("/profile", authMiddleware, checkUserActive, getUserProfile);
router.put("/change-password", authMiddleware, checkUserActive, changePassword);
router.post(
  "/register-device",
  authMiddleware,
  checkUserActive,
  registerDevice
);

module.exports = router;
