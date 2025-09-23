// migrationScript.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Impor model-model yang diperlukan
const User = require("./src/models/User");
const SuperAdmin = require("./src/models/SuperAdmin");
const Guru = require("./src/models/Guru");
const Siswa = require("./src/models/Siswa");

const MONGO_URI = process.env.DB_URI;

const migrateUsers = async () => {
  try {
    // 1. Koneksi ke Database
    await mongoose.connect(MONGO_URI);
    console.log("✅ Berhasil terhubung ke MongoDB untuk migrasi.");

    // 2. Hapus data user lama untuk mencegah duplikasi jika skrip dijalankan ulang
    await User.deleteMany({});
    console.log("🗑️ Koleksi 'users' lama berhasil dibersihkan.");

    // 3. Ambil semua data dari koleksi lama
    const superAdmins = await SuperAdmin.find({});
    const gurus = await Guru.find({});
    const siswas = await Siswa.find({});
    console.log(
      `🔍 Ditemukan: ${superAdmins.length} Super Admin, ${gurus.length} Guru, ${siswas.length} Siswa.`
    );

    // 4. Transformasi data ke format User baru
    const usersToCreate = [];

    superAdmins.forEach((admin) => {
      usersToCreate.push({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        identifier: admin.identifier,
        password: admin.password,
        role: "super_admin",
        isActive: admin.isActive,
        isPasswordDefault: admin.isPasswordDefault,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      });
    });

    gurus.forEach((guru) => {
      usersToCreate.push({
        _id: guru._id,
        name: guru.name,
        email: guru.email,
        identifier: guru.identifier,
        password: guru.password,
        role: "guru",
        mataPelajaran: guru.mataPelajaran,
        isActive: guru.isActive,
        isPasswordDefault: guru.isPasswordDefault,
        createdAt: guru.createdAt,
        updatedAt: guru.updatedAt,
      });
    });

    siswas.forEach((siswa) => {
      usersToCreate.push({
        _id: siswa._id,
        name: siswa.name,
        email: siswa.email,
        identifier: siswa.identifier,
        password: siswa.password,
        role: "siswa",
        kelas: siswa.kelas,
        isActive: siswa.isActive,
        isPasswordDefault: siswa.isPasswordDefault,
        createdAt: siswa.createdAt,
        updatedAt: siswa.updatedAt,
      });
    });

    // 5. Simpan semua user yang sudah ditransformasi ke koleksi baru
    if (usersToCreate.length > 0) {
      await User.insertMany(usersToCreate);
      console.log(
        `✅ Berhasil memigrasikan ${usersToCreate.length} pengguna ke koleksi 'users' baru.`
      );
    } else {
      console.log("ℹ️ Tidak ada pengguna untuk dimigrasikan.");
    }
  } catch (error) {
    console.error("❌ Gagal menjalankan skrip migrasi:", error);
  } finally {
    // 6. Tutup koneksi setelah selesai
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 Koneksi MongoDB ditutup.");
    }
  }
};

// Jalankan fungsi migrasi
migrateUsers();
