// models/SesiPresensi.js - Model baru untuk sesi presensi
const mongoose = require("mongoose");

const sesiPresensiSchema = new mongoose.Schema(
  {
    jadwal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jadwal",
      required: true,
    },

    kodeUnik: {
      type: String,
      required: true,
      unique: true,
    },

    lokasi: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    tanggal: {
      type: String,
      required: true, // Format: YYYY-MM-DD
    },

    // Waktu kedaluwarsa sesi (misal: 15 menit setelah dibuat)
    expiredAt: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    dibuatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guru",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire documents setelah waktu kedaluwarsa
sesiPresensiSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SesiPresensi", sesiPresensiSchema);
