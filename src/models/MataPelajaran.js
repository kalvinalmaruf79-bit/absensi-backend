// models/MataPelajaran.js
const mongoose = require("mongoose");

const mataPelajaranSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, unique: true },
    kode: { type: String, required: true, unique: true },
    deskripsi: { type: String },

    guru: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Diubah ke User
      },
    ],

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

module.exports = mongoose.model("MataPelajaran", mataPelajaranSchema);
