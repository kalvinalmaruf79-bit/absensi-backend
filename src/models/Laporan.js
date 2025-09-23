// src/models/Laporan.js
const mongoose = require("mongoose");

const laporanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },
    filePath: {
      type: String,
      required: [true, "Lokasi file tidak boleh kosong"],
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, "Nama file tidak boleh kosong"],
      trim: true,
    },
    deskripsi: {
      type: String,
      trim: true,
      maxlength: [500, "Deskripsi maksimal 500 karakter"],
    },
    kategori: {
      type: String,
      enum: ["tugas", "izin", "lainnya"],
      default: "lainnya",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Laporan", laporanSchema);
