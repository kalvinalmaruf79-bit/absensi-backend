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
        url: String, // Menggantikan filePath
        public_id: String, // ID unik dari Cloudinary untuk menghapus
        fileType: String,
      },
    ],
    links: [
      {
        title: String,
        url: String,
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Materi", materiSchema);
