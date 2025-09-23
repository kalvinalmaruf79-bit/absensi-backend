// src/seed/seed.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // Diubah ke User
require("dotenv").config();

const MONGO_URI = process.env.DB_URI;

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Berhasil terhubung ke MongoDB untuk seeding.");

    const existingAdmin = await User.findOne({
      // Diubah ke User
      identifier: "superadmin",
    });
    if (existingAdmin) {
      console.log("ℹ️ Super admin sudah ada. Seeding tidak diperlukan.");
      return;
    }

    console.log("⏳ Membuat akun super admin...");
    const hashedPassword = await bcrypt.hash("password123", 10);

    const newSuperAdmin = new User({
      // Diubah ke User
      name: "Super Admin",
      email: "superadmin@sekolah.com",
      identifier: "superadmin",
      password: hashedPassword,
      role: "super_admin", // Role ditambahkan
      isPasswordDefault: false,
    });

    await newSuperAdmin.save();
    console.log("✅ Akun super admin berhasil dibuat!");
    console.log("   - Identifier: superadmin");
    console.log("   - Password: password123");
  } catch (error) {
    console.error("❌ Gagal menjalankan seeder:", error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 Koneksi MongoDB ditutup.");
    }
  }
};

seedSuperAdmin();
