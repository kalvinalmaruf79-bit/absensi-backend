// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    identifier: { type: String, required: true, unique: true }, // NIS/NIP/ID
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "guru", "siswa"],
      required: true,
    },

    // --- PERUBAHAN DIMULAI DI SINI ---

    // Khusus untuk siswa: Kelas aktif saat ini
    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
      required: function () {
        return this.role === "siswa";
      },
    },

    // BARU: Riwayat kelas untuk siswa
    riwayatKelas: [
      {
        kelas: { type: mongoose.Schema.Types.ObjectId, ref: "Kelas" },
        tahunAjaran: String,
        semester: String,
      },
    ],

    // --- PERUBAHAN SELESAI DI SINI ---

    // Khusus untuk guru
    mataPelajaran: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MataPelajaran",
      },
    ],

    // Status akun
    isActive: { type: Boolean, default: true },

    // Password default
    isPasswordDefault: { type: Boolean, default: true },

    // Untuk reset password
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
