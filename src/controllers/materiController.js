// src/controllers/materiController.js
const Materi = require("../models/Materi");
const fs = require("fs");
const path = require("path");

exports.createMateri = async (req, res) => {
  try {
    // Ambil data yang sudah divalidasi dan diparsing
    const { judul, deskripsi, mataPelajaran, kelas, parsedLinks } = req.body;

    // Validasi input dasar
    if (!judul || !deskripsi || !mataPelajaran || !kelas) {
      if (req.files) {
        req.files.forEach((file) => fs.unlinkSync(file.path));
      }
      return res.status(400).json({ message: "Semua field wajib diisi." });
    }

    // Ambil data file dari req.files yang disediakan multer
    const files = req.files?.map((file) => ({
      fileName: file.originalname,
      filePath: file.path,
      fileType: file.mimetype,
    }));

    const materi = new Materi({
      judul,
      deskripsi,
      mataPelajaran,
      kelas,
      guru: req.user.id,
      files: files || [],
      links: parsedLinks, // Gunakan data links yang sudah diparsing
    });

    await materi.save();
    res.status(201).json({ message: "Materi berhasil dibuat.", materi });
  } catch (error) {
    console.error("Error creating materi:", error);
    // Hapus file jika terjadi error saat menyimpan ke database
    if (req.files) {
      req.files.forEach((file) => fs.unlinkSync(file.path));
    }
    res
      .status(500)
      .json({ message: "Gagal membuat materi.", error: error.message });
  }
};
// Siswa & Guru: Mendapatkan materi berdasarkan kelas dan mapel
exports.getMateri = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId } = req.query;
    if (!kelasId || !mataPelajaranId) {
      return res.status(400).json({
        message: "Parameter kelasId dan mataPelajaranId wajib diisi.",
      });
    }
    const materi = await Materi.find({
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    })
      .populate("guru", "name")
      .sort({ createdAt: -1 });
    res.json(materi);
  } catch (error) {
    console.error("Error getting materi:", error);
    res.status(500).json({ message: "Gagal mengambil materi." });
  }
};

// Guru: Update materi (ENDPOINT BARU)
exports.updateMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, deskripsi } = req.body;

    const materi = await Materi.findById(id);

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    if (materi.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak mengubah materi ini." });
    }

    materi.judul = judul || materi.judul;
    materi.deskripsi = deskripsi || materi.deskripsi;

    await materi.save();
    res.json({ message: "Materi berhasil diupdate.", materi });
  } catch (error) {
    console.error("Error updating materi:", error);
    res.status(500).json({ message: "Gagal mengupdate materi." });
  }
};

// Guru: Hapus materi (ENDPOINT BARU)
exports.deleteMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const materi = await Materi.findById(id);

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    if (materi.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak menghapus materi ini." });
    }

    // Hapus file fisik dari server
    if (materi.files && materi.files.length > 0) {
      materi.files.forEach((file) => {
        if (fs.existsSync(file.filePath)) {
          fs.unlinkSync(file.filePath);
        }
      });
    }

    await Materi.findByIdAndDelete(id);

    res.json({ message: "Materi berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting materi:", error);
    res.status(500).json({ message: "Gagal menghapus materi." });
  }
};
