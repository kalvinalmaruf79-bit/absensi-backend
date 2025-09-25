// src/models/Materi.js
const mongoose = require("mongoose");

const materiSchema = new mongoose.Schema(
  {
    judul: { type: String, required: true },
    deskripsi: { type: String },
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
    files: [
      {
        fileName: String,
        filePath: String,
        fileType: String,
      },
    ],
    links: [
      {
        title: String,
        url: String,
      },
    ],
    // --- FIELD BARU DIMULAI DI SINI ---
    isPublished: {
      type: Boolean,
      default: true, // Materi akan langsung terlihat secara default
    },
    // --- FIELD BARU SELESAI DI SINI ---
  },
  { timestamps: true }
);

module.exports = mongoose.model("Materi", materiSchema);
