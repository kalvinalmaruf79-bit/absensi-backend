// src/controllers/pengajuanAbsensiController.js
const PengajuanAbsensi = require("../models/PengajuanAbsensi");
const Absensi = require("../models/Absensi");
const User = require("../models/User");
const Kelas = require("../models/Kelas"); // Pastikan model Kelas diimpor
const fs = require("fs");

// Siswa: Membuat pengajuan izin/sakit baru
exports.createPengajuan = async (req, res) => {
  try {
    const { tanggal, keterangan, alasan } = req.body;
    if (!tanggal || !keterangan || !alasan) {
      if (req.file) fs.unlinkSync(req.file.path); // Hapus file jika validasi gagal
      return res
        .status(400)
        .json({ message: "Tanggal, keterangan, dan alasan wajib diisi." });
    }

    const pengajuan = new PengajuanAbsensi({
      siswa: req.user.id,
      tanggal,
      keterangan,
      alasan,
      fileBukti: req.file ? req.file.path : null,
    });

    await pengajuan.save();
    res
      .status(201)
      .json({ message: "Pengajuan berhasil dikirim.", data: pengajuan });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Gagal membuat pengajuan." });
  }
};

// Siswa: Melihat riwayat pengajuannya
exports.getPengajuanSiswa = async (req, res) => {
  try {
    const riwayat = await PengajuanAbsensi.find({ siswa: req.user.id })
      .populate("ditinjauOleh", "name")
      .sort({ createdAt: -1 });
    res.json(riwayat);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil riwayat pengajuan." });
  }
};

// Guru/Admin: Melihat semua pengajuan yang masuk
exports.getAllPengajuan = async (req, res) => {
  try {
    const { status, tanggal } = req.query;
    let filter = {};
    if (status) filter.status = status;
    if (tanggal) filter.tanggal = tanggal;

    // Jika user adalah wali kelas (dari middleware verifyWaliKelas),
    // filter pengajuan hanya untuk siswa di kelas perwaliannya.
    if (req.kelasWali) {
      filter.siswa = { $in: req.kelasWali.siswa };
    } else if (req.user.role !== "super_admin") {
      // Jika bukan super_admin dan bukan wali kelas yang terverifikasi,
      // kembalikan array kosong untuk keamanan.
      return res.json([]);
    }
    // Super admin akan melihat semua pengajuan tanpa filter siswa.

    const daftarPengajuan = await PengajuanAbsensi.find(filter)
      .populate("siswa", "name identifier kelas")
      .populate({
        path: "siswa",
        populate: { path: "kelas", select: "nama" },
      })
      .sort({ createdAt: -1 });
    res.json(daftarPengajuan);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil daftar pengajuan." });
  }
};

// Guru/Admin: Meninjau (menyetujui/menolak) pengajuan
exports.reviewPengajuan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "disetujui" atau "ditolak"

    if (!["disetujui", "ditolak"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status harus 'disetujui' atau 'ditolak'." });
    }

    const pengajuan = await PengajuanAbsensi.findById(id);
    if (!pengajuan) {
      return res.status(404).json({ message: "Pengajuan tidak ditemukan." });
    }
    if (pengajuan.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Pengajuan ini sudah pernah ditinjau." });
    }

    // Validasi: Pastikan Wali Kelas hanya meninjau siswanya
    if (req.user.role !== "super_admin") {
      // req.kelasWali disediakan oleh middleware verifyWaliKelas
      if (!req.kelasWali) {
        return res
          .status(403)
          .json({ message: "Anda bukan wali kelas aktif." });
      }

      // Cek apakah siswa yang mengajukan ada di dalam daftar siswa perwalian
      const isSiswaWali = req.kelasWali.siswa.some((idSiswa) =>
        idSiswa.equals(pengajuan.siswa)
      );

      if (!isSiswaWali) {
        return res
          .status(403)
          .json({ message: "Anda tidak berhak meninjau pengajuan siswa ini." });
      }
    }

    pengajuan.status = status;
    pengajuan.ditinjauOleh = req.user.id;
    await pengajuan.save();

    // AKSI OTOMATIS SAAT DISETUJUI
    if (status === "disetujui") {
      await Absensi.updateMany(
        { siswa: pengajuan.siswa, tanggal: pengajuan.tanggal },
        // Ganti status 'alpa' menjadi keterangan dari pengajuan (izin/sakit)
        { $set: { keterangan: pengajuan.keterangan } }
      );
    }

    res.json({
      message: `Pengajuan berhasil di-${status}.`,
      data: pengajuan,
    });
  } catch (error) {
    console.error("Review Pengajuan Error:", error);
    res.status(500).json({ message: "Gagal meninjau pengajuan." });
  }
};
