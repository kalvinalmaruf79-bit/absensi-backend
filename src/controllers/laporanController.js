// src/controllers/laporanController.js
const Laporan = require("../models/Laporan");
const path = require("path");
const fs = require("fs");

// Upload Laporan
exports.uploadLaporan = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "❌ Tidak ada file yang dikirim." });
    }

    const { deskripsi, kategori } = req.body;
    if (!deskripsi || deskripsi.trim() === "") {
      fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ message: "❌ Deskripsi laporan wajib diisi." });
    }

    const laporan = new Laporan({
      user: req.user.id,
      filePath: req.file.path,
      fileName: req.file.originalname,
      deskripsi: deskripsi.trim(),
      kategori: kategori || "lainnya",
    });

    await laporan.save();
    return res.status(201).json({ message: "✅ Laporan berhasil diupload" });
  } catch (err) {
    console.error("❌ Upload Error:", err.message);

    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res
      .status(500)
      .json({ message: "❌ Gagal upload laporan", error: err.message });
  }
};

// Get Semua Laporan (dengan filter opsional tanggal)
exports.getSemuaLaporan = async (req, res) => {
  try {
    const { tanggal } = req.query;

    let filter = {};
    if (tanggal) {
      const start = new Date(tanggal);
      const end = new Date(tanggal);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const laporan = await Laporan.find(filter).populate(
      "user",
      "name email role"
    );
    res.status(200).json(laporan);
  } catch (err) {
    console.error("❌ Error ambil laporan:", err.message);
    res
      .status(500)
      .json({ message: "❌ Gagal mengambil data laporan", error: err.message });
  }
};

// Download Laporan
exports.downloadLaporan = async (req, res) => {
  try {
    const laporan = await Laporan.findById(req.params.id);
    if (!laporan)
      return res.status(404).json({ message: "❌ File tidak ditemukan" });

    const filePath = path.resolve(laporan.filePath);
    if (!fs.existsSync(filePath))
      return res
        .status(404)
        .json({ message: "❌ File tidak tersedia di server." });

    res.download(filePath, laporan.fileName);
  } catch (err) {
    console.error("❌ Download Error:", err.message);
    res
      .status(500)
      .json({ message: "❌ Gagal download file", error: err.message });
  }
};
