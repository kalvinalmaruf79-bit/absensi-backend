// models/Nilai.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // 1. Impor plugin

const nilaiSchema = new mongoose.Schema(
  {
    siswa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },
    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
      required: true,
    },
    mataPelajaran: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MataPelajaran",
      required: true,
    },
    guru: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },
    jenisPenilaian: {
      type: String,
      enum: ["tugas", "uts", "uas", "praktik", "harian"], // 'praktek' diubah menjadi 'praktik'
      required: true,
    },
    // PERUBAHAN BARU: Relasi ke tugas spesifik
    tugas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tugas",
      required: function () {
        return this.jenisPenilaian === "tugas";
      },
    },
    nilai: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    deskripsi: { type: String },
    semester: {
      type: String,
      enum: ["ganjil", "genap"],
      required: true,
    },
    tahunAjaran: { type: String, required: true },
    tanggalPenilaian: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// DIHAPUS: Index unik yang lama dihapus untuk memungkinkan multiple input.
/*
nilaiSchema.index(
  {
    siswa: 1,
    mataPelajaran: 1,
    jenisPenilaian: 1,
    semester: 1,
    tahunAjaran: 1,
  },
  { unique: true }
);
*/

// PERUBAHAN BARU: Index terpisah untuk optimasi query
nilaiSchema.index({ siswa: 1, mataPelajaran: 1 });
nilaiSchema.index({ kelas: 1, tahunAjaran: 1, semester: 1 });

// 2. Tambahkan plugin ke skema
nilaiSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Nilai", nilaiSchema);
