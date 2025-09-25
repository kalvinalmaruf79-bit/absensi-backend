// models/Kelas.js
const mongoose = require("mongoose");

const kelasSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true }, // PERBAIKAN: unique:true dihapus
    tingkat: { type: String, required: true },
    jurusan: { type: String, required: true },
    waliKelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    siswa: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tahunAjaran: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// PENAMBAHAN: Membuat kombinasi nama kelas dan tahun ajaran menjadi unik
kelasSchema.index({ nama: 1, tahunAjaran: 1 }, { unique: true });

module.exports = mongoose.model("Kelas", kelasSchema);
