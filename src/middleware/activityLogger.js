// src/middleware/activityLogger.js
const ActivityLog = require("../models/ActivityLog");

/**
 * Middleware untuk mencatat aktivitas Super Admin.
 * @param {string} action - Nama aksi yang dilakukan (misal: 'CREATE_USER', 'DELETE_KELAS').
 * @param {(req: import('express').Request) => string} getDetails - Fungsi untuk menghasilkan pesan detail log.
 */
const logActivity = (action, getDetails) => {
  return async (req, res, next) => {
    // Tunggu hingga request selesai diproses
    res.on("finish", async () => {
      // Hanya catat jika request berhasil (status code 2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const details = getDetails(req, res); // Dapatkan detail dari fungsi yang diberikan
          await ActivityLog.create({
            user: req.user.id, // User yang login (Super Admin)
            action,
            details,
            resourceId: req.params.id, // ID dari resource yang diubah/dibuat
          });
        } catch (err) {
          console.error("Gagal mencatat log aktivitas:", err);
        }
      }
    });
    next();
  };
};

module.exports = logActivity;
