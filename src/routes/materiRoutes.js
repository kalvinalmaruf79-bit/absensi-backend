// src/routes/materiRoutes.js
const express = require("express");
const router = express.Router();
const createUploader = require("../middleware/uploadMiddleware");
const materiController = require("../controllers/materiController");
const {
  authMiddleware,
  verifyGuru,
  verifyAnyUser,
  verifySiswa,
} = require("../middleware/authMiddleware");

// Setup uploader untuk materi dengan limit 10MB dan tipe file yang sesuai
const materiUploader = createUploader(10, [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

// Middleware untuk parse links dari JSON string
const parseLinksFromBody = (req, res, next) => {
  if (req.body.links) {
    try {
      req.body.parsedLinks = JSON.parse(req.body.links);
      if (!Array.isArray(req.body.parsedLinks)) {
        return res.status(400).json({
          message:
            "Format 'links' harus berupa array dalam bentuk JSON string.",
        });
      }
    } catch (error) {
      return res.status(400).json({ message: "Format 'links' tidak valid." });
    }
  } else {
    req.body.parsedLinks = [];
  }
  next();
};

// @route   POST /api/materi
// @desc    Create new materi (Guru only)
// @access  Private/Guru
router.post(
  "/",
  authMiddleware,
  verifyGuru,
  materiUploader.array("files", 5),
  parseLinksFromBody,
  materiController.createMateri
);

// @route   GET /api/materi/siswa
// @desc    Get all materi untuk siswa (published only, filtered by kelas siswa)
// @access  Private/Siswa
router.get(
  "/siswa",
  authMiddleware,
  verifySiswa,
  materiController.getMateriSiswa
);

// @route   GET /api/materi/mata-pelajaran/:mataPelajaranId
// @desc    Get materi by mata pelajaran (with pagination)
// @access  Private
router.get(
  "/mata-pelajaran/:mataPelajaranId",
  authMiddleware,
  verifyAnyUser,
  materiController.getMateriByMataPelajaran
);

// @route   GET /api/materi/:id
// @desc    Get materi by ID
// @access  Private
router.get(
  "/:id",
  authMiddleware,
  verifyAnyUser,
  materiController.getMateriById
);

// @route   GET /api/materi
// @desc    Get materi by kelas and mataPelajaran
// @access  Private
router.get("/", authMiddleware, verifyAnyUser, materiController.getMateri);

// @route   PUT /api/materi/:id
// @desc    Update materi (Guru only)
// @access  Private/Guru
router.put(
  "/:id",
  authMiddleware,
  verifyGuru,
  materiUploader.array("files", 5),
  parseLinksFromBody,
  materiController.updateMateri
);

// @route   PATCH /api/materi/:id/toggle-publish
// @desc    Toggle publish status (Guru only)
// @access  Private/Guru
router.patch(
  "/:id/toggle-publish",
  authMiddleware,
  verifyGuru,
  materiController.togglePublishMateri
);

// @route   DELETE /api/materi/:id/file/:publicId
// @desc    Delete specific file from materi (Guru only)
// @access  Private/Guru
router.delete(
  "/:id/file/:publicId",
  authMiddleware,
  verifyGuru,
  materiController.deleteMateriFile
);

// @route   DELETE /api/materi/:id
// @desc    Delete materi (Guru only)
// @access  Private/Guru
router.delete(
  "/:id",
  authMiddleware,
  verifyGuru,
  materiController.deleteMateri
);

module.exports = router;
