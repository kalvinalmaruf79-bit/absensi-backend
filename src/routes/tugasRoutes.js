// src/routes/tugasRoutes.js
const express = require("express");
const router = express.Router();
const createUploader = require("../middleware/uploadMiddleware");

const tugasUploader = createUploader(20); // Maks 20MB

const {
  createTugas,
  getTugasByKelas,
  getTugasById,
  updateTugas,
  deleteTugas,
  submitTugas,
  getTugasSubmissions,
  gradeSubmission,
  getTugasSiswa,
  updateSubmission,
} = require("../controllers/tugasController");

const {
  authMiddleware,
  verifyGuru,
  verifySiswa,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

// Create Tugas (Guru only)
router.post("/", authMiddleware, verifyGuru, createTugas);

// Get All Tugas (Guru & Siswa)
router.get("/", authMiddleware, verifyAnyUser, getTugasByKelas);
// siswa tugas list
router.get("/siswa/list", authMiddleware, verifySiswa, getTugasSiswa);

// Get Single Tugas by ID (Guru & Siswa)
router.get("/:id", authMiddleware, verifyAnyUser, getTugasById);

// Update Tugas (Guru only)
router.put("/:id", authMiddleware, verifyGuru, updateTugas);

// Delete Tugas (Guru only)
router.delete("/:id", authMiddleware, verifyGuru, deleteTugas);

// Submit Tugas (Siswa only)
router.post(
  "/:id/submit",
  authMiddleware,
  verifySiswa,
  tugasUploader.single("file"),
  submitTugas
);

// Get Submissions (Guru only)
router.get(
  "/:tugasId/submissions",
  authMiddleware,
  verifyGuru,
  getTugasSubmissions
);

// Grade Submission (Guru only)
router.put(
  "/submission/:submissionId/grade",
  authMiddleware,
  verifyGuru,
  gradeSubmission
);
router.put(
  "/:id/resubmit",
  authMiddleware,
  verifySiswa,
  tugasUploader.single("file"),
  updateSubmission
);
module.exports = router;
