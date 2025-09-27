// src/middleware/uploadMiddleware.js
const multer = require("multer");

/**
 * Membuat instance Multer yang dikonfigurasi untuk memory storage.
 * @param {number} [fileSizeLimitMB=5] - Batas ukuran file dalam megabyte.
 * @param {string[]} [allowedMimeTypes] - Array string MIME type yang diizinkan.
 * @returns {multer.Instance}
 */
const createUploader = (
  fileSizeLimitMB = 5,
  allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
) => {
  // Simpan file di memori sebagai Buffer
  const storage = multer.memoryStorage();

  const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const errorMessage = `Error: Tipe file '${
        file.mimetype
      }' tidak diizinkan! Hanya (${allowedMimeTypes.join(
        ", "
      )}) yang didukung.`;
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
