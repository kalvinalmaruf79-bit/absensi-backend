// models/Jadwal.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // 1. Impor plugin

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
      ref: "User", // Diubah ke User
      required: true,
    },

    hari: {
      type: String,
      enum: ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"],
      required: true,
    },

    jamMulai: { type: String, required: true }, // Format: "07:00"
    jamSelesai: { type: String, required: true }, // Format: "08:30"

    semester: {
      type: String,
      enum: ["ganjil", "genap"],
      required: true,
    },

    tahunAjaran: { type: String, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Diubah ke User
      required: true,
    },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

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

// 2. Tambahkan plugin ke skema
jadwalSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Jadwal", jadwalSchema);
