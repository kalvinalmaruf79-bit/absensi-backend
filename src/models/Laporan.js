// src/models/Laporan.js
const mongoose = require("mongoose"); // 🧩 Import mongoose untuk membuat skema model MongoDB

const laporanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId, // Relasi ke koleksi User
      refPath: "userRole", // Referensi dinamis berdasarkan field userRole
      required: true, // Harus diisi (wajib)
    },
    userRole: {
      type: String,
      required: true,
      enum: ["Siswa", "Guru", "SuperAdmin"],
    },
    filePath: {
      type: String,
      required: [true, "Lokasi file tidak boleh kosong"], // Lokasi file wajib diisi
      trim: true, // Hapus spasi di awal/akhir
    },
    fileName: {
      type: String,
      required: [true, "Nama file tidak boleh kosong"], // Nama file wajib diisi
      trim: true, // Hapus spasi di awal/akhir
    },
    deskripsi: {
      type: String,
      trim: true, // Hapus spasi
      maxlength: [500, "Deskripsi maksimal 500 karakter"], // Batas maksimum 500 karakter
    },
    kategori: {
      type: String,
      enum: ["tugas", "izin", "lainnya"], // Hanya boleh 3 pilihan nilai
      default: "lainnya", // Default jika tidak diisi
    },
  },
  {
    timestamps: true, // Otomatis tambahkan createdAt dan updatedAt
  }
);

module.exports = mongoose.model("Laporan", laporanSchema); // Ekspor model 'Laporan' agar bisa digunakan di controller
1;
