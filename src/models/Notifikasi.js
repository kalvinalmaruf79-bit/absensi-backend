// src/models/Notifikasi.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // 1. Impor plugin

const notifikasiSchema = new mongoose.Schema(
  {
    penerima: {
      // ID User Siswa
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tipe: {
      type: String,
      enum: [
        "tugas_baru",
        "nilai_baru",
        "pengumuman_baru",
        "pengingat_presensi",
        "presensi_alpa",
      ], // Menambahkan tipe notifikasi baru dari cron job
      required: true,
    },
    judul: {
      type: String,
      required: true,
    },
    pesan: {
      type: String,
      required: true,
    },
    // ID dokumen terkait (Tugas, Nilai, Pengumuman) untuk navigasi
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notifikasiSchema.index({ penerima: 1, isRead: 1, createdAt: -1 });

// 2. Tambahkan plugin ke skema
notifikasiSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Notifikasi", notifikasiSchema);
