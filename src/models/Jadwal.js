// models/Jadwal.js
const mongoose = require("mongoose");

const jadwalSchema = new mongoose.Schema(
  {
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

    hari: {
      type: String,
      enum: ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"],
      required: true,
    },

    jamMulai: { type: String, required: true }, // Format: "07:00"
    jamSelesai: { type: String, required: true }, // Format: "08:30"

    // Semester
    semester: {
      type: String,
      enum: ["ganjil", "genap"],
      required: true,
    },

    tahunAjaran: { type: String, required: true },

    // Dibuat oleh super admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      required: true,
    },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Index untuk mencegah jadwal bentrok
jadwalSchema.index(
  {
    kelas: 1,
    hari: 1,
    jamMulai: 1,
    jamSelesai: 1,
    tahunAjaran: 1,
    semester: 1,
  },
  { unique: true }
);

module.exports = mongoose.model("Jadwal", jadwalSchema);
