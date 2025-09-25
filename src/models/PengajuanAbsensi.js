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
      type: String, // Path ke file bukti (misal: surat dokter)
    },
    status: {
      type: String,
      enum: ["pending", "disetujui", "ditolak"],
      default: "pending",
    },
    ditinjauOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Guru/Wali Kelas/Admin
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PengajuanAbsensi", pengajuanAbsensiSchema);
