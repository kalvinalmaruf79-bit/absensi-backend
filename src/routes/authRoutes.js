// routes/authRoutes.js
const express = require("express");
const router = express.Router();

const {
  loginUser,
  getUserProfile,
  changePassword,
  forgotPassword,
  verifyResetToken, // Endpoint verifikasi
  resetPassword,
} = require("../controllers/authController");

const {
  authMiddleware,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Rute Publik
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);

// BEST PRACTICE: Pisahkan endpoint GET untuk verifikasi dan PUT untuk submit
router.get("/reset-password/:token", verifyResetToken);
router.put("/reset-password/:token", resetPassword);

// Rute Terproteksi
router.get("/profile", authMiddleware, checkUserActive, getUserProfile);
router.put("/change-password", authMiddleware, checkUserActive, changePassword);

module.exports = router;
