// models/MataPelajaran.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // 1. Impor plugin

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

// 2. Tambahkan plugin ke skema
mataPelajaranSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("MataPelajaran", mataPelajaranSchema);
