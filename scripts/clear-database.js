const mongoose = require("mongoose");
const readline = require("readline");
require("dotenv").config();

// Impor SEMUA model yang ada di proyek Anda
const Absensi = require("../src/models/Absensi");
const Jadwal = require("../src/models/Jadwal");
const Kelas = require("../src/models/Kelas");
const Laporan = require("../src/models/Laporan");
const MataPelajaran = require("../src/models/MataPelajaran");
const Materi = require("../src/models/Materi");
const Nilai = require("../src/models/Nilai");
const Pengumuman = require("../src/models/Pengumuman");
const SesiPresensi = require("../src/models/SesiPresensi");
const Tugas = require("../src/models/Tugas");
const User = require("../src/models/User");

const MONGO_URI = process.env.DB_URI;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const clearDatabase = async () => {
  if (!MONGO_URI) {
    console.error("❌ DB_URI (koneksi database) tidak ditemukan di file .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Berhasil terhubung ke MongoDB.");

    console.log("⏳ Memulai proses penghapusan data dari semua model...");

    // Membuat array dari semua model untuk di-loop
    const models = [
      Absensi,
      Jadwal,
      Kelas,
      Laporan,
      MataPelajaran,
      Materi,
      Nilai,
      Pengumuman,
      SesiPresensi,
      Tugas,
    ];

    const promises = [];

    // Menghapus semua dokumen dari setiap model (selain User)
    for (const model of models) {
      console.log(`   - Menghapus data dari koleksi: ${model.collection.name}`);
      promises.push(model.deleteMany({}));
    }

    // Menjalankan semua promise penghapusan
    await Promise.all(promises);

    // Menghapus semua user KECUALI super_admin
    console.log(
      `   - Menghapus data dari koleksi: users (kecuali super_admin)`
    );
    await User.deleteMany({ role: { $ne: "super_admin" } });

    console.log(
      "\n✅✅✅ Database berhasil dibersihkan! Semua data telah dihapus."
    );
    console.log("ℹ️ Akun Super Admin tetap ada untuk akses awal.");
  } catch (error) {
    console.error("❌ Gagal membersihkan database:", error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 Koneksi MongoDB ditutup.");
    }
  }
};

console.log("================================================================");
console.log(
  "🚨 PERINGATAN: SKRIP INI AKAN MENGHAPUS SEMUA DATA             🚨"
);
console.log("🚨        KECUALI AKUN SUPER ADMIN ANDA                       🚨");
console.log("================================================================");
rl.question('Untuk konfirmasi, ketik "iya" dan tekan Enter: ', (answer) => {
  if (answer.toLowerCase() === "iya") {
    clearDatabase();
  } else {
    console.log("🚫 Aksi dibatalkan.");
    rl.close();
  }
});
