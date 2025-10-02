// models/Absensi.js (Updated)
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // 1. Impor plugin

const absensiSchema = new mongoose.Schema(
  {
    siswa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },
    sesiPresensi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SesiPresensi",
      required: true,
    },
    jadwal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jadwal",
      required: true,
    },
    waktuMasuk: {
      type: Date,
      default: Date.now,
    },
    keterangan: {
      type: String,
      enum: ["hadir", "izin", "sakit", "alpa"],
      default: "hadir",
    },
    lokasiSiswa: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    tanggal: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// 2. Tambahkan plugin ke skema
absensiSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Absensi", absensiSchema);
