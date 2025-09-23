// models/Nilai.js
const mongoose = require("mongoose");

const nilaiSchema = new mongoose.Schema(
  {
    siswa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Siswa",
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
      ref: "Guru",
      required: true,
    },

    // Jenis penilaian
    jenisPenilaian: {
      type: String,
      enum: ["tugas", "uts", "uas", "praktek", "harian"],
      required: true,
    },

    // Nilai numerik
    nilai: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Deskripsi/catatan nilai
    deskripsi: { type: String },

    // Semester dan tahun ajaran
    semester: {
      type: String,
      enum: ["ganjil", "genap"],
      required: true,
    },

    tahunAjaran: { type: String, required: true },

    // Tanggal penilaian
    tanggalPenilaian: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Index untuk mencegah duplikasi nilai dengan jenis yang sama
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

module.exports = mongoose.model("Nilai", nilaiSchema);
