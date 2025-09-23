// =================================================================
// INDEX.JS - ENTRY POINT APLIKASI SISTEM MANAJEMEN SEKOLAH
// =================================================================

// 1. IMPORT DEPENDENSI
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const os = require("os"); // <-- Diperlukan untuk mendapatkan IP Jaringan
const fileUpload = require("express-fileupload"); // <-- Diperlukan untuk upload screenshot
require("dotenv").config();

// 2. KONFIGURASI APLIKASI
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.DB_URI || "mongodb://localhost:27017/sekolah_api_db";

// 3. MIDDLEWARE
app.use(cors()); // Mengizinkan request dari origin lain
app.use(express.json()); // Parsing body JSON
app.use(express.urlencoded({ extended: true })); // Parsing body URL-encoded
app.use(fileUpload()); // Middleware untuk menangani upload file (req.files)

// Middleware untuk menyajikan file statis dari folder 'uploads' dan 'public'
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "src/public")));

// 4. IMPORT ROUTES
const authRoutes = require("./src/routes/authRoutes");
const superAdminRoutes = require("./src/routes/superAdminRoutes");
const guruRoutes = require("./src/routes/guruRoutes");
const siswaRoutes = require("./src/routes/siswaRoutes");
const absensiRoutes = require("./src/routes/absensiRoutes");
const qrRoutes = require("./src/routes/qrRoutes");
const laporanRoutes = require("./src/routes/laporanRoutes");
const commonRoutes = require("./src/routes/commonRoutes");
const uploadRoutes = require("./src/routes/uploadRoutes");

// 5. MOUNTING ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/guru", guruRoutes);
app.use("/api/siswa", siswaRoutes);
app.use("/api/absensi", absensiRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/laporan", laporanRoutes);
app.use("/api/common", commonRoutes);
app.use("/api/upload", uploadRoutes);

// 6. SPECIAL ROUTES (HEALTH CHECK & 404)
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "API Sistem Manajemen Sekolah Berjalan",
    timestamp: new Date().toISOString(),
  });
});

// Handler untuk rute yang tidak ditemukan (404)
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
      // Cari alamat IP v4 di jaringan lokal
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

      console.log("\n🛣️  Endpoint API yang terpasang:");
      app._router.stack.forEach((layer) => {
        if (layer.route) {
          // Menangani rute tunggal seperti /api/health
          const path = layer.route.path;
          const methods = Object.keys(layer.route.methods)
            .map((m) => m.toUpperCase())
            .join(", ");
          if (path.startsWith("/api/")) {
            console.log(`  - ${methods} ${path}`);
          }
        } else if (
          layer.name === "router" &&
          layer.regexp.source.includes("api")
        ) {
          // Menangani grup router
          const path = layer.regexp.source
            .replace("^\\/", "/")
            .replace("\\/?(?=\\/|$)", "")
            .replace(/\\\//g, "/");
          if (path !== "/*") {
            console.log(`  - GROUP ${path}`);
          }
        }
      });
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
