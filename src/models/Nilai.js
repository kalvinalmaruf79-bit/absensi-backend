// models/Nilai.js
const mongoose = require("mongoose");

const nilaiSchema = new mongoose.Schema(
  {
    siswa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },

    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
      required: true,
    },

    mataPelajaran: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MataPelajaran",
      required: true,
    },

    guru: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },

    jenisPenilaian: {
      type: String,
      enum: ["tugas", "uts", "uas", "praktek", "harian"],
      required: true,
    },

    nilai: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    deskripsi: { type: String },

    semester: {
      type: String,
      enum: ["ganjil", "genap"],
      required: true,
    },

    tahunAjaran: { type: String, required: true },

    tanggalPenilaian: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

nilaiSchema.index(
  {
    siswa: 1,
    mataPelajaran: 1,
    jenisPenilaian: 1,
    semester: 1,
    tahunAjaran: 1,
  },
  { unique: true }
);

module.exports = mongoose.model("Nilai", nilaiSchema);
