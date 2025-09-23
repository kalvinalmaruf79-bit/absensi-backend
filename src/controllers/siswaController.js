// controllers/siswaController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Nilai = require("../models/Nilai");
const Jadwal = require("../models/Jadwal");
const Absensi = require("../models/Absensi");

// Dashboard siswa
exports.getDashboard = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id).populate(
      "kelas",
      "nama tingkat jurusan"
    );
    if (!siswa || siswa.role !== "siswa") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    const hariIni = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ][new Date().getDay()];
    const jadwalHariIni = await Jadwal.find({
      kelas: siswa.kelas._id,
      hari: hariIni,
      isActive: true,
    })
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name")
      .sort({ jamMulai: 1 });

    const nilaiTerbaru = await Nilai.find({ siswa: siswa._id })
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const presensiStats = await Absensi.aggregate([
      {
        $match: {
          siswa: new mongoose.Types.ObjectId(req.user.id),
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: "$keterangan", count: { $sum: 1 } } },
    ]);

    const statsObj = {};
    presensiStats.forEach((stat) => {
      statsObj[stat._id] = stat.count;
    });

    res.json({
      siswa: {
        name: siswa.name,
        identifier: siswa.identifier,
        kelas: siswa.kelas,
      },
      jadwalHariIni,
      nilaiTerbaru,
      statistikPresensi: {
        hadir: statsObj.hadir || 0,
        izin: statsObj.izin || 0,
        sakit: statsObj.sakit || 0,
        alpa: statsObj.alpa || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get jadwal siswa
exports.getJadwalSiswa = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id);
    if (!siswa || siswa.role !== "siswa" || !siswa.kelas) {
      return res
        .status(400)
        .json({ message: "Siswa tidak ditemukan atau belum memiliki kelas." });
    }

    const jadwal = await Jadwal.find({ kelas: siswa.kelas, isActive: true })
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier")
      .sort({ hari: 1, jamMulai: 1 });

    const jadwalPerHari = {
      senin: [],
      selasa: [],
      rabu: [],
      kamis: [],
      jumat: [],
      sabtu: [],
    };
    jadwal.forEach((j) => {
      if (jadwalPerHari[j.hari]) jadwalPerHari[j.hari].push(j);
    });

    res.json(jadwalPerHari);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get nilai siswa
exports.getNilaiSiswa = async (req, res) => {
  try {
    const nilai = await Nilai.find({ siswa: req.user.id })
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name");
    res.json(nilai);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get riwayat presensi siswa
exports.getRiwayatPresensi = async (req, res) => {
  try {
    const presensi = await Absensi.find({ siswa: req.user.id })
      .populate({
        path: "jadwal",
        populate: {
          path: "mataPelajaran guru kelas",
          select: "nama kode name tingkat jurusan",
        },
      })
      .sort({ createdAt: -1 });
    res.json(presensi);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get teman sekelas
exports.getTemanSekelas = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id);
    if (!siswa || siswa.role !== "siswa" || !siswa.kelas) {
      return res
        .status(400)
        .json({ message: "Siswa tidak ditemukan atau belum memiliki kelas." });
    }

    const temanSekelas = await User.find({
      kelas: siswa.kelas,
      _id: { $ne: siswa._id },
      role: "siswa",
      isActive: true,
    })
      .select("name identifier")
      .sort({ name: 1 });

    res.json(temanSekelas);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
