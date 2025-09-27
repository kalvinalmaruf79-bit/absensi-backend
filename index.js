// =================================================================
// INDEX.JS - ENTRY POINT APLIKASI SISTEM MANAJEMEN SEKOLAH
// =================================================================

// 1. IMPORT DEPENDENSI
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const os = require("os");
require("dotenv").config();

// 2. KONFIGURASI APLIKASI
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.DB_URI || "mongodb://localhost:27017/sekolah_api_db";

// 3. MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/public", express.static(path.join(__dirname, "src/public")));

// 4. IMPORT ROUTES
const authRoutes = require("./src/routes/authRoutes");
const superAdminRoutes = require("./src/routes/superAdminRoutes");
const guruRoutes = require("./src/routes/guruRoutes");
const siswaRoutes = require("./src/routes/siswaRoutes");
const absensiRoutes = require("./src/routes/absensiRoutes");
const qrRoutes = require("./src/routes/qrRoutes");
const commonRoutes = require("./src/routes/commonRoutes");
const pengumumanRoutes = require("./src/routes/pengumumanRoutes");
const materiRoutes = require("./src/routes/materiRoutes");
const tugasRoutes = require("./src/routes/tugasRoutes");
const akademikRoutes = require("./src/routes/akademikRoutes");
const cronRoutes = require("./src/routes/cronRoutes"); // Impor rute baru

// 5. MOUNTING ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/guru", guruRoutes);
app.use("/api/siswa", siswaRoutes);
app.use("/api/absensi", absensiRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/common", commonRoutes);
app.use("/api/pengumuman", pengumumanRoutes);
app.use("/api/materi", materiRoutes);
app.use("/api/tugas", tugasRoutes);
app.use("/api/akademik", akademikRoutes);
app.use("/api/cron", cronRoutes); // Daftarkan rute baru

// 6. SPECIAL ROUTES (HEALTH CHECK & 404)
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "API Sistem Manajemen Sekolah Berjalan",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: "Endpoint tidak ditemukan.",
    requestedUrl: req.originalUrl,
  });
});

// 7. GLOBAL ERROR HANDLER
app.use((error, req, res, next) => {
  console.error("❌ GLOBAL ERROR HANDLER:", error);
  res.status(500).json({
    message: "Terjadi kesalahan internal pada server.",
    error:
      process.env.NODE_ENV === "production" ? "Internal Error" : error.message,
  });
});

// 8. KONEKSI DATABASE DAN START SERVER
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ Berhasil terhubung ke MongoDB");

    app.listen(PORT, "0.0.0.0", () => {
      const networkInterfaces = os.networkInterfaces();
      let networkAddress = null;
      for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
          if (net.family === "IPv4" && !net.internal) {
            networkAddress = net.address;
            break;
          }
        }
        if (networkAddress) break;
      }

      console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
      if (networkAddress) {
        console.log(
          `   Atau di jaringan Anda: http://${networkAddress}:${PORT}`
        );
      }
    });
  })
  .catch((error) => {
    console.error("❌ Gagal terhubung ke MongoDB:", error);
    process.exit(1);
  });

// 9. GRACEFUL SHUTDOWN
const gracefulShutdown = async (signal) => {
  console.log(`\n👋 Menerima sinyal ${signal}, server akan dimatikan.`);
  try {
    await mongoose.connection.close();
    console.log("🔌 Koneksi MongoDB berhasil ditutup.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Gagal menutup koneksi MongoDB:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
