// src/models/Pengumuman.js
const mongoose = require("mongoose");

const pengumumanSchema = new mongoose.Schema(
  {
    judul: {
      type: String,
      required: [true, "Judul pengumuman tidak boleh kosong"],
      trim: true,
    },
    isi: {
      type: String,
      required: [true, "Isi pengumuman tidak boleh kosong"],
    },
    pembuat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetRole: {
      type: String,
      enum: ["semua", "guru", "siswa"],
      default: "semua",
    },
    targetKelas: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Kelas",
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Pengumuman", pengumumanSchema);
