// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    identifier: { type: String, required: true, unique: true }, // NIS/NIP/ID Super Admin
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "guru", "siswa"],
      required: true,
    },

    // Khusus untuk siswa
    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
      required: function () {
        return this.role === "siswa";
      },
    },

    // Khusus untuk guru - mata pelajaran yang diajar
    mataPelajaran: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MataPelajaran",
      },
    ],

    // Status akun
    isActive: { type: Boolean, default: true },

    // Password default flag untuk pertama kali login
    isPasswordDefault: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
