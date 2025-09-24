// src/controllers/pengumumanController.js
const Pengumuman = require("../models/Pengumuman");
const User = require("../models/User");

// Membuat pengumuman baru (Super Admin / Guru)
exports.createPengumuman = async (req, res) => {
  try {
    const { judul, isi, targetRole, targetKelas } = req.body;

    if (!judul || !isi) {
      return res
        .status(400)
        .json({ message: "Judul dan isi pengumuman wajib diisi." });
    }

    const pengumuman = new Pengumuman({
      judul,
      isi,
      pembuat: req.user.id,
      targetRole,
      targetKelas: targetRole === "siswa" && targetKelas ? targetKelas : [],
    });

    await pengumuman.save();
    res
      .status(201)
      .json({ message: "Pengumuman berhasil dibuat.", pengumuman });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Mendapatkan semua pengumuman yang relevan untuk user
exports.getPengumuman = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    let query = {
      isPublished: true,
      $or: [
        { targetRole: "semua" },
        { targetRole: user.role },
        { targetKelas: { $in: [user.kelas] } },
      ],
    };

    const pengumuman = await Pengumuman.find(query)
      .populate("pembuat", "name role")
      .populate("targetKelas", "nama")
      .sort({ createdAt: -1 });

    res.json(pengumuman);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
