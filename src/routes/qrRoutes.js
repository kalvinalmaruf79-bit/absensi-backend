// routes/qrRoutes.js (Updated)
const express = require("express");
const router = express.Router();

const { generateQR } = require("../controllers/qrController");
const { authMiddleware, verifyGuru } = require("../middleware/authMiddleware");

// Generate QR Code - hanya guru
router.post("/generate", authMiddleware, verifyGuru, generateQR);

module.exports = router;
