// src/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Membuat dan mengkonfigurasi middleware Multer untuk upload file.
 * @param {string} subfolder - Nama subfolder di dalam direktori 'uploads' untuk menyimpan file.
 * @param {number} [maxSize=20] - Ukuran file maksimum dalam MB.
 * @param {RegExp} [allowedTypes=/pdf|jpg|jpeg|png|doc|docx|ppt|pptx|xlsx|mp4|mkv/] - Regex untuk tipe file yang diizinkan.
 * @returns {multer} Instance multer yang sudah dikonfigurasi.
 */
const createUploader = (
  subfolder,
  maxSize = 20,
  allowedTypes = /pdf|jpg|jpeg|png|doc|docx|ppt|pptx|xlsx|mp4|mkv/
) => {
  const uploadDir = path.join(__dirname, `../../uploads/${subfolder}`);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  });

  const fileFilter = (req, file, cb) => {
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(
      new Error(
        `Error: Tipe file tidak diizinkan! Hanya (${allowedTypes}) yang didukung.`
      )
    );
  };

  return multer({
    storage,
    limits: { fileSize: maxSize * 1024 * 1024 }, // Ukuran dalam MB
    fileFilter,
  });
};

module.exports = createUploader;
