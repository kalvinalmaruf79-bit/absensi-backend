// src/seed/seed.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
// BENAR: Path diubah menjadi '../' untuk naik satu level dari folder 'seed'
const SuperAdmin = require("../models/SuperAdmin");
require("dotenv").config();

const MONGO_URI = process.env.DB_URI;

const seedSuperAdmin = async () => {
  try {
    // 1. Koneksi ke Database
    // Opsi 'useNewUrlParser' dan 'useUnifiedTopology' dihapus karena sudah tidak berlaku di Mongoose versi baru.
    await mongoose.connect(MONGO_URI);
    console.log("✅ Berhasil terhubung ke MongoDB untuk seeding.");

    // 2. Cek apakah super admin sudah ada
    const existingAdmin = await SuperAdmin.findOne({
      identifier: "superadmin",
    });
    if (existingAdmin) {
      console.log("ℹ️ Super admin sudah ada. Seeding tidak diperlukan.");
      return; // Hentikan proses jika sudah ada
    }

    // 3. Jika belum ada, buat super admin baru
    console.log("⏳ Membuat akun super admin...");
    const hashedPassword = await bcrypt.hash("password123", 10); // Hash password

    const newSuperAdmin = new SuperAdmin({
      name: "Super Admin",
      email: "superadmin@sekolah.com",
      identifier: "superadmin", // Ini akan digunakan untuk login
      password: hashedPassword,
      isPasswordDefault: false, // Set ke false agar tidak diminta ganti password
    });

    await newSuperAdmin.save();
    console.log("✅ Akun super admin berhasil dibuat!");
    console.log("   - Identifier: superadmin");
    console.log("   - Password: password123");
  } catch (error) {
    console.error("❌ Gagal menjalankan seeder:", error);
  } finally {
    // 4. Tutup koneksi setelah selesai
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 Koneksi MongoDB ditutup.");
    }
  }
};

// Jalankan fungsi seeder
seedSuperAdmin();
