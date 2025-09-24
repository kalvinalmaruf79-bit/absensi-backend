// src/models/Tugas.js
const mongoose = require("mongoose");

const tugasSchema = new mongoose.Schema(
  {
    judul: { type: String, required: true },
    deskripsi: { type: String, required: true },
    mataPelajaran: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MataPelajaran",
      required: true,
    },
    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
      required: true,
    },
    guru: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deadline: { type: Date, required: true },
    submissions: [
      {
        siswa: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        filePath: String,
        fileName: String,
        submittedAt: { type: Date, default: Date.now },
        nilai: { type: Number, min: 0, max: 100 },
        feedback: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tugas", tugasSchema);
