// tools/clearDatabase.js
const mongoose = require("mongoose");
const readline = require("readline");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

// Impor SEMUA model yang ada di proyek Anda
const Absensi = require("../src/models/Absensi");
const Jadwal = require("../src/models/Jadwal");
const Kelas = require("../src/models/Kelas");
const MataPelajaran = require("../src/models/MataPelajaran");
const Materi = require("../src/models/Materi");
const Nilai = require("../src/models/Nilai");
const Pengumuman = require("../src/models/Pengumuman");
const SesiPresensi = require("../src/models/SesiPresensi");
const Tugas = require("../src/models/Tugas");
const User = require("../src/models/User");
const PengajuanAbsensi = require("../src/models/PengajuanAbsensi");
const Notifikasi = require("../src/models/Notifikasi"); // <-- DITAMBAHKAN
const Settings = require("../src/models/Settings"); // <-- DITAMBAHKAN

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
      MataPelajaran,
      Materi,
      Nilai,
      Pengumuman,
      SesiPresensi,
      Tugas,
      PengajuanAbsensi,
      Notifikasi, // <-- DITAMBAHKAN
    ];

    const promises = [];

    // Menghapus semua dokumen dari setiap model (selain User dan Settings)
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

    // Membersihkan koleksi settings (opsional, jika ingin reset ke default saat aplikasi start)
    console.log(`   - Menghapus data dari koleksi: settings`);
    await Settings.deleteMany({}); // Menghapus semua dokumen settings

    console.log(
      "\n✅✅✅ Database berhasil dibersihkan! Semua data telah dihapus."
    );
    console.log(
      "ℹ️ Akun Super Admin dan Pengaturan Global tetap ada untuk akses awal."
    );
  } catch (error) {
    console.error("❌ Gagal membersihkan database:", error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 Koneksi MongoDB ditutup.");
    }
    rl.close();
  }
};

console.log("================================================================");
console.log("🚨 PERINGATAN: SKRIP INI AKAN MENGHAPUS SEMUA DATA         🚨");
console.log("🚨               KECUALI AKUN SUPER ADMIN ANDA              🚨");
console.log("================================================================");
rl.question('Untuk konfirmasi, ketik "iya" dan tekan Enter: ', (answer) => {
  if (answer.toLowerCase() === "iya") {
    clearDatabase();
  } else {
    console.log("🚫 Aksi dibatalkan.");
    rl.close();
  }
});
