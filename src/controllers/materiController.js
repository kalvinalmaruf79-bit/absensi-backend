// src/controllers/materiController.js
const Materi = require("../models/Materi");
const { uploadFromBuffer, deleteFile } = require("../utils/cloudinary");

exports.createMateri = async (req, res) => {
  try {
    const { judul, deskripsi, mataPelajaran, kelas, parsedLinks } = req.body;

    if (!judul || !deskripsi || !mataPelajaran || !kelas) {
      return res.status(400).json({ message: "Semua field wajib diisi." });
    }

    let filesToSave = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadFromBuffer(file.buffer, "materi-pelajaran");
        filesToSave.push({
          fileName: file.originalname,
          url: result.secure_url,
          public_id: result.public_id,
          fileType: file.mimetype,
        });
      }
    }

    const materi = new Materi({
      judul,
      deskripsi,
      mataPelajaran,
      kelas,
      guru: req.user.id,
      files: filesToSave,
      links: parsedLinks,
    });

    await materi.save();
    res.status(201).json({ message: "Materi berhasil dibuat.", materi });
  } catch (error) {
    console.error("Error creating materi:", error);
    // Jika terjadi error, hapus file yang mungkin sudah terunggah ke Cloudinary
    // (Implementasi rollback sederhana)
    if (filesToSave && filesToSave.length > 0) {
      for (const file of filesToSave) {
        await deleteFile(file.public_id);
      }
    }
    res
      .status(500)
      .json({ message: "Gagal membuat materi.", error: error.message });
  }
};

exports.getMateri = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId } = req.query;
    if (!kelasId || !mataPelajaranId) {
      return res.status(400).json({
        message: "Parameter kelasId dan mataPelajaranId wajib diisi.",
      });
    }

    let filter = {
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    };

    if (req.user.role === "siswa") {
      filter.isPublished = true;
    }

    const materi = await Materi.find(filter)
      .populate("guru", "name")
      .sort({ createdAt: -1 });
    res.json(materi);
  } catch (error) {
    console.error("Error getting materi:", error);
    res.status(500).json({ message: "Gagal mengambil materi." });
  }
};

exports.togglePublishMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const materi = await Materi.findById(id);

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    if (materi.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak mengubah materi ini." });
    }

    materi.isPublished = !materi.isPublished;
    await materi.save();

    res.json({
      message: `Materi berhasil di-${
        materi.isPublished ? "terbitkan" : "sembunyikan"
      }.`,
      materi,
    });
  } catch (error) {
    console.error("Error toggling publish materi:", error);
    res.status(500).json({ message: "Gagal mengubah status publikasi." });
  }
};

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

    // Hapus semua file terkait dari Cloudinary
    if (materi.files && materi.files.length > 0) {
      for (const file of materi.files) {
        if (file.public_id) {
          await deleteFile(file.public_id);
        }
      }
    }

    await Materi.findByIdAndDelete(id);

    res.json({ message: "Materi dan semua file terkait berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting materi:", error);
    res.status(500).json({ message: "Gagal menghapus materi." });
  }
};
