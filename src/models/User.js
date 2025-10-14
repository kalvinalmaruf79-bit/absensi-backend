// models/User.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // 1. Impor plugin

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

    // Khusus untuk siswa: Kelas aktif saat ini
    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
      required: function () {
        return this.role === "siswa";
      },
    },

    // Riwayat kelas untuk siswa
    riwayatKelas: [
      {
        kelas: { type: mongoose.Schema.Types.ObjectId, ref: "Kelas" },
        tahunAjaran: String,
        semester: String,
      },
    ],

    // Khusus untuk guru
    mataPelajaran: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MataPelajaran",
      },
    ],

    // Menyimpan token untuk push notification
    deviceTokens: [
      {
        type: String,
      },
    ],

    // Status akun
    isActive: { type: Boolean, default: true },

    // Password default
    isPasswordDefault: { type: Boolean, default: true },

    // Untuk reset password
    resetPasswordToken: String,
    resetPasswordTempToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// 2. Tambahkan plugin ke skema
userSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("User", userSchema);
