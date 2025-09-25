// src/models/Notifikasi.js
const mongoose = require("mongoose");

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
      enum: ["tugas_baru", "nilai_baru", "pengumuman_baru"],
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

module.exports = mongoose.model("Notifikasi", notifikasiSchema);
