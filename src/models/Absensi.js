// models/Absensi.js (Updated)
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const absensiSchema = new mongoose.Schema(
  {
    siswa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // PERUBAHAN: Dibuat tidak wajib (required: false) karena absensi dari
    // pengajuan izin/sakit tidak memiliki sesi QR.
    sesiPresensi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SesiPresensi",
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
    // PERUBAHAN: Dibuat tidak wajib (required: false) karena absensi dari
    // pengajuan izin/sakit tidak memiliki data lokasi.
    lokasiSiswa: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    tanggal: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    // PERUBAHAN BARU: Menambahkan referensi ke dokumen pengajuan absensi
    // untuk jejak audit yang jelas.
    pengajuanAbsensi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PengajuanAbsensi",
    },
  },
  {
    timestamps: true,
  }
);

absensiSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Absensi", absensiSchema);
