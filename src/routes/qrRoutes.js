// routes/qrRoutes.js (Corrected)
const express = require("express");
const router = express.Router();

const {
  generateQR,
  checkActiveSessions,
} = require("../controllers/qrController");
const { authMiddleware, verifyGuru } = require("../middleware/authMiddleware");

// Generate QR Code - hanya guru
router.post("/generate", authMiddleware, verifyGuru, generateQR);

// Check active sessions - hanya guru
router.get("/check-active", authMiddleware, verifyGuru, checkActiveSessions);

module.exports = router;
