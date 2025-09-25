// src/controllers/pengumumanController.js
const Pengumuman = require("../models/Pengumuman");
const User = require("../models/User");
const Notifikasi = require("../models/Notifikasi");
const sendPushNotification = require("../utils/sendPushNotification"); // Impor utility baru

// Helper untuk membuat notifikasi di database
const createBulkNotifikasi = async (
  penerimaIds,
  tipe,
  judul,
  pesan,
  resourceId
) => {
  const notifikasi = penerimaIds.map((penerima) => ({
    penerima,
    tipe,
    judul,
    pesan,
    resourceId,
  }));
  if (notifikasi.length > 0) {
    await Notifikasi.insertMany(notifikasi);
  }
};

// Membuat pengumuman baru
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

    // Tentukan target user untuk notifikasi
    let targetQuery = {};
    if (targetRole && targetRole !== "semua") {
      targetQuery.role = targetRole;
    }
    if (targetKelas && targetKelas.length > 0) {
      targetQuery.kelas = { $in: targetKelas };
    }

    // Ambil user beserta deviceTokens
    const targetUsers = await User.find(targetQuery).select("_id deviceTokens");
    if (targetUsers.length > 0) {
      const userIds = targetUsers.map((u) => u._id);
      const playerIds = targetUsers.flatMap((u) => u.deviceTokens);

      // Buat notifikasi di database
      await createBulkNotifikasi(
        userIds,
        "pengumuman_baru",
        `Pengumuman Baru: ${judul}`,
        "Ada pengumuman baru untuk Anda.",
        pengumuman._id
      );

      // KIRIM PUSH NOTIFICATION
      sendPushNotification(
        playerIds,
        `Pengumuman: ${judul}`,
        "Lihat pengumuman baru di aplikasi.",
        { type: "pengumuman_baru", resourceId: pengumuman._id.toString() }
      );
    }

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
