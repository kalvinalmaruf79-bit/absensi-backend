// src/routes/tugasRoutes.js
const express = require("express");
const router = express.Router();
const createUploader = require("../middleware/uploadMiddleware");

// PERBAIKAN: Memanggil createUploader dengan argumen yang benar
const tugasUploader = createUploader(20); // Maks 20MB, menggunakan default mimetypes

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
  tugasUploader.single("file"),
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
