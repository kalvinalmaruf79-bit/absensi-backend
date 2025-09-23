// models/MataPelajaran.js
const mongoose = require("mongoose");

const mataPelajaranSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, unique: true },
    kode: { type: String, required: true, unique: true }, // Misal: MTK, BHS, IPA
    deskripsi: { type: String },

    // Guru yang mengampu mata pelajaran ini
    guru: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Guru", // Direferensikan ke model Guru
      },
    ],

    // Dibuat oleh super admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin", // Direferensikan ke model SuperAdmin
      required: true,
    },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MataPelajaran", mataPelajaranSchema);
