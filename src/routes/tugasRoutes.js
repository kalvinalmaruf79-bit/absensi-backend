// src/routes/tugasRoutes.js
const express = require("express");
const router = express.Router();
// Impor utility yang baru
const createUploader = require("../middleware/uploadMiddleware");

// Inisialisasi uploader khusus untuk tugas
const tugasUploader = createUploader("jawaban-tugas", 20); // Maks 20MB

const {
  createTugas,
  getTugasByKelas,
  submitTugas,
  getTugasSubmissions,
  gradeSubmission,
} = require("../controllers/tugasController");
const {
  authMiddleware,
  verifyGuru,
  verifySiswa,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

router.post("/", authMiddleware, verifyGuru, createTugas);
router.get("/", authMiddleware, verifyAnyUser, getTugasByKelas);
router.post(
  "/:id/submit",
  authMiddleware,
  verifySiswa,
  tugasUploader.single("file"), // Hanya 1 file
  submitTugas
);
router.get(
  "/:tugasId/submissions",
  authMiddleware,
  verifyGuru,
  getTugasSubmissions
);
router.put(
  "/submission/:submissionId/grade",
  authMiddleware,
  verifyGuru,
  gradeSubmission
);

module.exports = router;
