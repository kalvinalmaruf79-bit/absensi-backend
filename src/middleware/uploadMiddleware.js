// src/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Membuat instance Multer yang dikonfigurasi.
 * @param {string} destinationFolder - Subfolder di dalam 'uploads' untuk menyimpan file.
 * @param {number} [fileSizeLimitMB=5] - Batas ukuran file dalam megabyte.
 * @param {RegExp|string[]} [allowedFileTypes] - Regex atau array string MIME type yang diizinkan.
 * @returns {multer.Instance}
 */
const createUploader = (
  destinationFolder,
  fileSizeLimitMB = 5,
  allowedFileTypes = /jpeg|jpg|png|pdf/
) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const fullPath = path.join("uploads", destinationFolder);
      fs.mkdirSync(fullPath, { recursive: true });
      cb(null, fullPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  });

  // PERBAIKAN: Logika fileFilter dibuat lebih fleksibel
  const fileFilter = (req, file, cb) => {
    let isFileTypeAllowed = false;

    // Logika baru untuk menangani array MIME type
    if (Array.isArray(allowedFileTypes)) {
      isFileTypeAllowed = allowedFileTypes.includes(file.mimetype);
    }
    // Logika lama untuk mendukung regex (backward compatibility)
    else {
      isFileTypeAllowed = allowedFileTypes.test(file.mimetype);
    }

    if (isFileTypeAllowed) {
      cb(null, true);
    } else {
      const allowedTypesMessage = Array.isArray(allowedFileTypes)
        ? allowedFileTypes.join(", ")
        : allowedFileTypes.toString();
      const errorMessage = `Error: Tipe file '${file.mimetype}' tidak diizinkan! Hanya (${allowedTypesMessage}) yang didukung.`;
      cb(new Error(errorMessage), false);
    }
  };

  const upload = multer({
    storage: storage,
    limits: { fileSize: fileSizeLimitMB * 1024 * 1024 }, // Batas ukuran file
    fileFilter: fileFilter,
  });

  return upload;
};

module.exports = createUploader;
