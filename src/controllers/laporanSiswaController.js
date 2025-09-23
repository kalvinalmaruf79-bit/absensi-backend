// src/controllers/laporanSiswaController.js
const Laporan = require("../models/Laporan");
const fs = require("fs");
const path = require("path");

// Siswa melihat riwayat laporannya sendiri
exports.getLaporanSaya = async (req, res) => {
  try {
    const laporan = await Laporan.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.status(200).json(laporan);
  } catch (err) {
    console.error("❌ Error mengambil laporan siswa:", err.message);
    res.status(500).json({
      message: "❌ Gagal mengambil data laporan Anda",
      error: err.message,
    });
  }
};

// Siswa menghapus laporannya sendiri
exports.deleteLaporan = async (req, res) => {
  try {
    const { id } = req.params;

    // Middleware checkOwnership sudah memastikan laporan ini milik user
    const laporan = await Laporan.findById(id);
    if (!laporan) {
      return res.status(404).json({ message: "❌ Laporan tidak ditemukan." });
    }

    // Hapus file fisik dari server
    const filePath = path.resolve(laporan.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("❌ Gagal menghapus file fisik:", err);
          // Tetap lanjutkan proses hapus data dari DB
        }
      });
    }

    // Hapus data dari database
    await Laporan.findByIdAndDelete(id);

    res.status(200).json({ message: "✅ Laporan berhasil dihapus." });
  } catch (err) {
    console.error("❌ Error menghapus laporan:", err.message);
    res
      .status(500)
      .json({ message: "❌ Gagal menghapus laporan", error: err.message });
  }
};
