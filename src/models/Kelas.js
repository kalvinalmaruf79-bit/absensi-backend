// models/Kelas.js
const mongoose = require("mongoose");

const kelasSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, unique: true },
    tingkat: { type: String, required: true },
    jurusan: { type: String, required: true },

    waliKelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
    },

    siswa: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Diubah ke User
      },
    ],

    tahunAjaran: { type: String, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Kelas", kelasSchema);
