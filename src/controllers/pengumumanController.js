// src/controllers/pengumumanController.js
const Pengumuman = require("../models/Pengumuman");
const User = require("../models/User");
const Notifikasi = require("../models/Notifikasi");
const sendPushNotification = require("../utils/sendPushNotification");

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

// CREATE - Membuat pengumuman baru
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
      targetRole: targetRole || "semua",
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
      const playerIds = targetUsers.flatMap((u) => u.deviceTokens || []);

      // Buat notifikasi di database
      await createBulkNotifikasi(
        userIds,
        "pengumuman_baru",
        `Pengumuman Baru: ${judul}`,
        "Ada pengumuman baru untuk Anda.",
        pengumuman._id
      );

      // KIRIM PUSH NOTIFICATION
      if (playerIds.length > 0) {
        sendPushNotification(
          playerIds,
          `Pengumuman: ${judul}`,
          "Lihat pengumuman baru di aplikasi.",
          { type: "pengumuman_baru", resourceId: pengumuman._id.toString() }
        );
      }
    }

    res
      .status(201)
      .json({ message: "Pengumuman berhasil dibuat.", pengumuman });
  } catch (error) {
    console.error("Error creating pengumuman:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getPengumuman = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    let query = {};

    // Super admin dapat melihat semua pengumuman
    if (user.role === "super_admin") {
      // Super admin melihat semua pengumuman (baik published maupun draft)
      // Tidak ada filter tambahan
    } else {
      // Guru dan siswa hanya melihat yang published
      const orConditions = [{ targetRole: "semua" }, { targetRole: user.role }];

      // Jika siswa, tambahkan filter kelas
      if (user.role === "siswa" && user.kelas) {
        orConditions.push({
          targetRole: "siswa",
          targetKelas: { $in: [user.kelas] },
        });
      }

      query = {
        isPublished: true,
        $or: orConditions,
      };
    }

    const pengumuman = await Pengumuman.find(query)
      .populate("pembuat", "name role")
      .populate("targetKelas", "nama tingkat")
      .sort({ createdAt: -1 });

    res.json(pengumuman);
  } catch (error) {
    console.error("Error fetching pengumuman:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// READ - Mendapatkan pengumuman by ID
exports.getPengumumanById = async (req, res) => {
  try {
    const pengumuman = await Pengumuman.findById(req.params.id)
      .populate("pembuat", "name role")
      .populate("targetKelas", "nama tingkat");

    if (!pengumuman) {
      return res.status(404).json({ message: "Pengumuman tidak ditemukan." });
    }

    res.json(pengumuman);
  } catch (error) {
    console.error("Error fetching pengumuman:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// UPDATE - Mengupdate pengumuman
exports.updatePengumuman = async (req, res) => {
  try {
    const { judul, isi, targetRole, targetKelas, isPublished } = req.body;

    const pengumuman = await Pengumuman.findById(req.params.id);

    if (!pengumuman) {
      return res.status(404).json({ message: "Pengumuman tidak ditemukan." });
    }

    // Update fields
    if (judul) pengumuman.judul = judul;
    if (isi) pengumuman.isi = isi;
    if (targetRole) pengumuman.targetRole = targetRole;
    if (typeof isPublished !== "undefined")
      pengumuman.isPublished = isPublished;

    // Update targetKelas hanya jika targetRole adalah siswa
    if (targetRole === "siswa" && targetKelas) {
      pengumuman.targetKelas = targetKelas;
    } else if (targetRole !== "siswa") {
      pengumuman.targetKelas = [];
    }

    await pengumuman.save();

    res.json({ message: "Pengumuman berhasil diupdate.", pengumuman });
  } catch (error) {
    console.error("Error updating pengumuman:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// DELETE - Menghapus pengumuman
exports.deletePengumuman = async (req, res) => {
  try {
    const pengumuman = await Pengumuman.findByIdAndDelete(req.params.id);

    if (!pengumuman) {
      return res.status(404).json({ message: "Pengumuman tidak ditemukan." });
    }

    // Hapus notifikasi terkait (optional)
    await Notifikasi.deleteMany({ resourceId: req.params.id });

    res.json({ message: "Pengumuman berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting pengumuman:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// TOGGLE PUBLISH - Publish/Unpublish pengumuman
exports.togglePublishPengumuman = async (req, res) => {
  try {
    const pengumuman = await Pengumuman.findById(req.params.id);

    if (!pengumuman) {
      return res.status(404).json({ message: "Pengumuman tidak ditemukan." });
    }

    pengumuman.isPublished = !pengumuman.isPublished;
    await pengumuman.save();

    // Jika dipublish, kirim notifikasi
    if (pengumuman.isPublished) {
      let targetQuery = {};
      if (pengumuman.targetRole && pengumuman.targetRole !== "semua") {
        targetQuery.role = pengumuman.targetRole;
      }
      if (pengumuman.targetKelas && pengumuman.targetKelas.length > 0) {
        targetQuery.kelas = { $in: pengumuman.targetKelas };
      }

      const targetUsers = await User.find(targetQuery).select(
        "_id deviceTokens"
      );
      if (targetUsers.length > 0) {
        const userIds = targetUsers.map((u) => u._id);
        const playerIds = targetUsers.flatMap((u) => u.deviceTokens || []);

        await createBulkNotifikasi(
          userIds,
          "pengumuman_baru",
          `Pengumuman Baru: ${pengumuman.judul}`,
          "Ada pengumuman baru untuk Anda.",
          pengumuman._id
        );

        if (playerIds.length > 0) {
          sendPushNotification(
            playerIds,
            `Pengumuman: ${pengumuman.judul}`,
            "Lihat pengumuman baru di aplikasi.",
            { type: "pengumuman_baru", resourceId: pengumuman._id.toString() }
          );
        }
      }
    }

    res.json({
      message: `Pengumuman berhasil ${
        pengumuman.isPublished ? "dipublikasi" : "di-unpublish"
      }.`,
      pengumuman,
    });
  } catch (error) {
    console.error("Error toggling publish:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
