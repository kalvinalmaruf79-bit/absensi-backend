// src/models/Settings.js
const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  // Kunci unik untuk memastikan hanya ada satu dokumen pengaturan
  key: {
    type: String,
    default: "global-settings",
    unique: true,
  },
  namaSekolah: {
    type: String,
    default: "SMK Negeri 1 Nanga Pinoh",
  },
  semesterAktif: {
    type: String,
    enum: ["ganjil", "genap"],
    default: "ganjil",
  },
  tahunAjaranAktif: {
    type: String,
    default: "2024/2025", // Contoh format
  },
  // Anda bisa menambahkan pengaturan lain di sini di masa depan
  // Misalnya: kepalaSekolah, alamatSekolah, dll.
});

// Fungsi statis untuk mendapatkan atau membuat pengaturan default
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: "global-settings" });
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);
