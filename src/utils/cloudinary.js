// src/utils/cloudinary.js
const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");

// Konfigurasi Cloudinary dengan environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Mengunggah file dari buffer ke Cloudinary.
 * @param {Buffer} buffer Buffer file dari multer.
 * @param {string} folder Folder di Cloudinary tempat menyimpan file.
 * @returns {Promise<object>} Hasil upload dari Cloudinary.
 */
const uploadFromBuffer = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "auto", // Biarkan Cloudinary mendeteksi tipe file
        type: "upload", // PENTING: Pastikan type adalah 'upload' bukan 'private'
        access_mode: "public", // TAMBAHAN: Set file menjadi publicly accessible
        // Untuk keamanan ekstra, bisa tambahkan:
        // allowed_formats: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"],
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    const readableStream = new Readable();
    readableStream._read = () => {};
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(stream);
  });
};

/**
 * Menghapus file dari Cloudinary menggunakan public_id.
 * @param {string} public_id Public ID dari file di Cloudinary.
 * @returns {Promise<object>} Hasil penghapusan dari Cloudinary.
 */
const deleteFile = (public_id) => {
  return new Promise((resolve, reject) => {
    // Untuk PDF dan file non-image, perlu specify resource_type
    // Coba delete sebagai 'raw' dulu, jika gagal coba 'image'
    cloudinary.uploader.destroy(
      public_id,
      { resource_type: "raw", invalidate: true },
      (error, result) => {
        if (result && result.result === "ok") {
          resolve(result);
        } else {
          // Fallback: coba sebagai image atau auto
          cloudinary.uploader.destroy(
            public_id,
            { invalidate: true },
            (error2, result2) => {
              if (result2) {
                resolve(result2);
              } else {
                reject(error2 || error);
              }
            }
          );
        }
      }
    );
  });
};

module.exports = { cloudinary, uploadFromBuffer, deleteFile };
