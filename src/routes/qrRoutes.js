// routes/qrRoutes.js - Updated
const express = require("express");
const router = express.Router();

const {
  generateQR,
  checkActiveSessions,
  endSession,
  endAllActiveSessions,
} = require("../controllers/qrController");
const { authMiddleware, verifyGuru } = require("../middleware/authMiddleware");

// Generate QR Code - hanya guru
router.post("/generate", authMiddleware, verifyGuru, generateQR);

// Check active sessions - hanya guru
router.get("/check-active", authMiddleware, verifyGuru, checkActiveSessions);

// End specific session - hanya guru
router.put("/end/:sesiId", authMiddleware, verifyGuru, endSession);

// End all active sessions (opsional) - hanya guru
router.put("/end-all", authMiddleware, verifyGuru, endAllActiveSessions);

module.exports = router;
