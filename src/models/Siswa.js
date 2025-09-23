// models/Siswa.js
const mongoose = require("mongoose");

const siswaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    identifier: { type: String, required: true, unique: true }, // NIS
    password: { type: String, required: true },
    role: {
      type: String,
      default: "siswa",
    },
    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
    },
    isActive: { type: Boolean, default: true },
    isPasswordDefault: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Siswa", siswaSchema);
