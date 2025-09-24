// src/routes/materiRoutes.js
const express = require("express");
const router = express.Router();
const createUploader = require("../middleware/uploadMiddleware");

const {
  createMateri,
  getMateri,
  updateMateri,
  deleteMateri,
} = require("../controllers/materiController");

const {
  authMiddleware,
  verifyGuru,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

// Inisialisasi uploader khusus untuk materi
const materiUploader = createUploader("materi-pelajaran", 50);

// Middleware kecil untuk mem-parsing 'links' setelah upload selesai
const parseLinksFromBody = (req, res, next) => {
  if (req.body.links) {
    try {
      req.body.parsedLinks = JSON.parse(req.body.links);
      if (!Array.isArray(req.body.parsedLinks)) {
        // Hapus file yang sudah terupload jika format links salah
        if (req.files) {
          req.files.forEach((file) => fs.unlinkSync(file.path));
        }
        return res.status(400).json({
          message:
            "Format 'links' harus berupa array dalam bentuk JSON string.",
        });
      }
    } catch (error) {
      if (req.files) {
        req.files.forEach((file) => fs.unlinkSync(file.path));
      }
      return res.status(400).json({
        message: "Format 'links' tidak valid.",
      });
    }
  } else {
    req.body.parsedLinks = [];
  }
  next();
};

// Terapkan middleware secara berurutan
router.post(
  "/",
  authMiddleware,
  verifyGuru,
  materiUploader.array("files", 5), // 1. Multer berjalan dulu
  parseLinksFromBody, // 2. Middleware parsing berjalan setelahnya
  createMateri // 3. Controller berjalan terakhir dengan data yang sudah siap
);

router.get("/", authMiddleware, verifyAnyUser, getMateri);
router.put("/:id", authMiddleware, verifyGuru, updateMateri);
router.delete("/:id", authMiddleware, verifyGuru, deleteMateri);

module.exports = router;
