// models/Kelas.js
const mongoose = require("mongoose");

const kelasSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, unique: true }, // Contoh: "X RPL 1"
    tingkat: { type: String, required: true }, // X, XI, XII
    jurusan: { type: String, required: true }, // RPL, TKJ, MM, dll

    // Wali kelas
    waliKelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guru",
    },

    // Siswa dalam kelas ini
    siswa: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Siswa",
      },
    ],

    // Tahun ajaran
    tahunAjaran: { type: String, required: true }, // 2024/2025

    // Dibuat oleh super admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      required: true,
    },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Kelas", kelasSchema);
