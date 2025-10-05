// src/controllers/pengajuanAbsensiController.js
const PengajuanAbsensi = require("../models/PengajuanAbsensi");
const Absensi = require("../models/Absensi");
const User = require("../models/User");
const Kelas = require("../models/Kelas");
const Jadwal = require("../models/Jadwal");
const { uploadFromBuffer } = require("../utils/cloudinary");
const mongoose = require("mongoose");

exports.createPengajuan = async (req, res) => {
  try {
    const { tanggal, keterangan, alasan, jadwalIds } = req.body;

    if (!tanggal || !keterangan || !alasan || !jadwalIds) {
      return res.status(400).json({
        message: "Tanggal, keterangan, alasan, dan jadwal wajib diisi.",
      });
    }

    let parsedJadwalIds;
    try {
      parsedJadwalIds = JSON.parse(jadwalIds);
      if (!Array.isArray(parsedJadwalIds) || parsedJadwalIds.length === 0) {
        throw new Error();
      }
    } catch (error) {
      return res.status(400).json({
        message: "Format 'jadwalIds' harus berupa array JSON string.",
      });
    }

    const siswa = await User.findById(req.user.id);
    const jadwalValid = await Jadwal.find({
      _id: { $in: parsedJadwalIds },
      kelas: siswa.kelas,
    });
    if (jadwalValid.length !== parsedJadwalIds.length) {
      return res
        .status(400)
        .json({ message: "Satu atau lebih jadwal tidak valid." });
    }

    let fileBuktiData = {};
    if (req.file) {
      const result = await uploadFromBuffer(req.file.buffer, "bukti-absensi");
      fileBuktiData = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    const pengajuan = new PengajuanAbsensi({
      siswa: req.user.id,
      tanggal,
      keterangan,
      alasan,
      jadwalTerkait: parsedJadwalIds,
      fileBukti: fileBuktiData,
    });

    await pengajuan.save();
    res
      .status(201)
      .json({ message: "Pengajuan berhasil dikirim.", data: pengajuan });
  } catch (error) {
    res.status(500).json({
      message: "Gagal membuat pengajuan.",
      error: error.message,
    });
  }
};

exports.getPengajuanSiswa = async (req, res) => {
  try {
    const riwayat = await PengajuanAbsensi.find({ siswa: req.user.id })
      .populate("ditinjauOleh", "name")
      .populate({
        path: "jadwalTerkait",
        select: "mataPelajaran jamMulai jamSelesai",
        populate: { path: "mataPelajaran", select: "nama" },
      })
      .sort({ createdAt: -1 });
    res.json(riwayat);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil riwayat pengajuan." });
  }
};

exports.getAllPengajuan = async (req, res) => {
  try {
    const { status, tanggal } = req.query;
    let filter = {};
    if (status) filter.status = status;
    if (tanggal) filter.tanggal = tanggal;

    if (req.kelasWali) {
      filter.siswa = { $in: req.kelasWali.siswa };
    } else if (req.user.role !== "super_admin") {
      return res.json([]);
    }

    const daftarPengajuan = await PengajuanAbsensi.find(filter)
      .populate("siswa", "name identifier kelas")
      .populate({
        path: "siswa",
        populate: { path: "kelas", select: "nama" },
      })
      .populate({
        path: "jadwalTerkait",
        select: "mataPelajaran jamMulai jamSelesai",
        populate: { path: "mataPelajaran", select: "nama" },
      })
      .sort({ createdAt: -1 });
    res.json(daftarPengajuan);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil daftar pengajuan." });
  }
};

exports.reviewPengajuan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

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

    if (req.user.role !== "super_admin") {
      const siswa = await User.findById(pengajuan.siswa);
      const kelasSiswa = await Kelas.findOne({ siswa: siswa._id });
      if (!kelasSiswa.waliKelas || !kelasSiswa.waliKelas.equals(req.user.id)) {
        return res
          .status(403)
          .json({ message: "Anda tidak berhak meninjau pengajuan siswa ini." });
      }
    }

    pengajuan.status = status;
    pengajuan.ditinjauOleh = req.user.id;
    await pengajuan.save();

    // --- PERUBAHAN UTAMA: Membuat record Absensi saat disetujui ---
    if (status === "disetujui") {
      const absensiBulkOps = pengajuan.jadwalTerkait.map((jadwalId) => ({
        updateOne: {
          filter: {
            siswa: pengajuan.siswa,
            jadwal: jadwalId,
            tanggal: pengajuan.tanggal,
          },
          update: {
            $set: {
              keterangan: pengajuan.keterangan,
              pengajuanAbsensi: pengajuan._id, // Menautkan ke pengajuan
              // Tidak ada sesiPresensi dan lokasiSiswa
            },
          },
          upsert: true,
        },
      }));

      if (absensiBulkOps.length > 0) {
        await Absensi.bulkWrite(absensiBulkOps);
      }
    }
    // -----------------------------------------------------------

    res.json({
      message: `Pengajuan berhasil di-${status}.`,
      data: pengajuan,
    });
  } catch (error) {
    console.error("Review Pengajuan Error:", error);
    res.status(500).json({ message: "Gagal meninjau pengajuan." });
  }
};
