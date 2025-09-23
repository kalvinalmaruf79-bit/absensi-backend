// routes/authRoutes.js (Updated)
const express = require("express");
const router = express.Router();

const {
  loginUser,
  getUserProfile,
  changePassword,
  firstTimePasswordChange,
} = require("../controllers/authController");

const {
  authMiddleware,
  checkUserActive,
} = require("../middleware/authMiddleware");

// Public routes
router.post("/login", loginUser);

// Protected routes - semua user yang sudah login
router.get("/profile", authMiddleware, checkUserActive, getUserProfile);
router.put("/change-password", authMiddleware, checkUserActive, changePassword);
router.put(
  "/first-time-password",
  authMiddleware,
  checkUserActive,
  firstTimePasswordChange
);

module.exports = router;
