// src/models/ActivityLog.js
const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      // Contoh actions: 'USER_LOGIN', 'VIEW_MATERI', 'SUBMIT_TUGAS'
    },
    details: {
      type: String, // Deskripsi singkat, misal: "Melihat materi 'Aljabar Linear'"
    },
    // ID dokumen terkait (Materi, Tugas, dll.) untuk referensi
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true, // Otomatis menambahkan createdAt dan updatedAt
  }
);

// Membuat TTL index agar log lama otomatis terhapus setelah 1 tahun (31536000 detik)
// Ini baik untuk menjaga ukuran database tetap optimal.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
