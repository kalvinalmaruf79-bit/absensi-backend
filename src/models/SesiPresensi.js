// models/SesiPresensi.js
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
      required: true,
    },

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
      ref: "User", // Diubah ke User
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

sesiPresensiSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SesiPresensi", sesiPresensiSchema);
