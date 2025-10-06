// models/Absensi.js (Updated - Final Version)
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const absensiSchema = new mongoose.Schema(
  {
    siswa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Tidak wajib karena absensi dari pengajuan izin/sakit tidak memiliki sesi QR
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
    // Tidak wajib karena absensi dari pengajuan izin/sakit tidak memiliki data lokasi
    lokasiSiswa: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    tanggal: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    // Referensi ke dokumen pengajuan absensi untuk jejak audit
    pengajuanAbsensi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PengajuanAbsensi",
    },
    // TAMBAHAN: Flag untuk input manual oleh guru
    // Berguna untuk membedakan:
    // - Absensi via QR Code (isManual: false, ada sesiPresensi)
    // - Absensi via Pengajuan (isManual: false, ada pengajuanAbsensi)
    // - Absensi input manual guru (isManual: true, tidak ada keduanya)
    isManual: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index untuk performa query
absensiSchema.index({ siswa: 1, jadwal: 1, tanggal: 1 }, { unique: true });
absensiSchema.index({ jadwal: 1, tanggal: 1 });
absensiSchema.index({ sesiPresensi: 1 });
absensiSchema.index({ pengajuanAbsensi: 1 });

absensiSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Absensi", absensiSchema);
