// src/models/PengajuanAbsensi.js
const mongoose = require("mongoose");

const pengajuanAbsensiSchema = new mongoose.Schema(
  {
    siswa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tanggal: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    jadwalTerkait: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Jadwal",
        required: true,
      },
    ],
    keterangan: {
      type: String,
      enum: ["izin", "sakit"],
      required: true,
    },
    alasan: {
      type: String,
      required: true,
      trim: true,
    },
    fileBukti: {
      url: String, // Path ke file bukti
      public_id: String, // ID dari Cloudinary
    },
    status: {
      type: String,
      enum: ["pending", "disetujui", "ditolak"],
      default: "pending",
    },
    ditinjauOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PengajuanAbsensi", pengajuanAbsensiSchema);
