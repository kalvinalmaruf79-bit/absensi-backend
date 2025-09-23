// routes/laporanRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  authMiddleware,
  verifyAdminOrGuru,
  verifySiswa,
  checkOwnership,
} = require("../middleware/authMiddleware");
const laporanAdminController = require("../controllers/laporanController");
const laporanSiswaController = require("../controllers/laporanSiswaController");
const Laporan = require("../models/Laporan");

const uploadDir = path.join(__dirname, "../../uploads/laporan");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() === ".pdf") {
    cb(null, true);
  } else {
    cb(new Error("Hanya file PDF yang diizinkan!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Middleware untuk menangani error multer
const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// === RUTE SISWA ===
router.post(
  "/upload",
  authMiddleware,
  verifySiswa,
  handleUpload,
  laporanAdminController.uploadLaporan // Controller upload tetap sama
);
router.get(
  "/saya",
  authMiddleware,
  verifySiswa,
  laporanSiswaController.getLaporanSaya
);
router.delete(
  "/:id",
  authMiddleware,
  verifySiswa,
  checkOwnership(Laporan), // Middleware untuk memastikan siswa hanya bisa hapus miliknya
  laporanSiswaController.deleteLaporan
);

// === RUTE ADMIN/GURU ===
router.get(
  "/semua",
  authMiddleware,
  verifyAdminOrGuru,
  laporanAdminController.getSemuaLaporan
);
router.get(
  "/download/:id",
  authMiddleware,
  verifyAdminOrGuru,
  laporanAdminController.downloadLaporan
);

module.exports = router;
