// models/Guru.js
const mongoose = require("mongoose");

const guruSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    identifier: { type: String, required: true, unique: true }, // NIP
    password: { type: String, required: true },
    role: {
      type: String,
      default: "guru",
    },
    mataPelajaran: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MataPelajaran",
      },
    ],
    isActive: { type: Boolean, default: true },
    isPasswordDefault: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Guru", guruSchema);
