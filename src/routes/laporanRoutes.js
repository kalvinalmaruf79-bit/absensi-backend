// routes/laporanRoutes.js (Updated)
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  authMiddleware,
  verifyAdminOrGuru,
  verifySiswa,
} = require("../middleware/authMiddleware");
const laporanController = require("../controllers/laporanController");

// Setup multer untuk upload
const uploadDir = path.join(__dirname, "../../uploads/laporan");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".pdf") {
    cb(null, true);
  } else {
    cb(new Error("Hanya file PDF yang diizinkan!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Upload laporan - hanya siswa
router.post(
  "/upload",
  authMiddleware,
  verifySiswa,
  (req, res, next) => {
    upload.single("file")(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ message: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  laporanController.uploadLaporan
);

// Lihat semua laporan - admin/guru
router.get(
  "/semua",
  authMiddleware,
  verifyAdminOrGuru,
  laporanController.getSemuaLaporan
);

// Download laporan - admin/guru
router.get(
  "/download/:id",
  authMiddleware,
  verifyAdminOrGuru,
  laporanController.downloadLaporan
);

module.exports = router;
