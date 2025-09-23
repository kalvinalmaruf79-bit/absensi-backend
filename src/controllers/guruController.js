// controllers/guruController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Jadwal = require("../models/Jadwal");
const Absensi = require("../models/Absensi");
const Nilai = require("../models/Nilai");
const Kelas = require("../models/Kelas");
const ExcelJS = require("exceljs");

// ============= DASHBOARD & PROFILE =============
exports.getDashboard = async (req, res) => {
  try {
    const guru = await User.findById(req.user.id).populate(
      "mataPelajaran",
      "nama kode"
    );
    if (!guru || guru.role !== "guru") {
      return res.status(404).json({ message: "Guru tidak ditemukan." });
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
      guru: guru._id,
      hari: hariIni,
      isActive: true,
    })
      .populate("kelas", "nama")
      .populate("mataPelajaran", "nama")
      .sort({ jamMulai: 1 });

    const jadwalGuru = await Jadwal.find({
      guru: guru._id,
      isActive: true,
    }).distinct("kelas");
    const totalSiswa = await User.countDocuments({
      role: "siswa",
      kelas: { $in: jadwalGuru },
      isActive: true,
    });

    res.json({
      guru: {
        name: guru.name,
        identifier: guru.identifier,
        mataPelajaran: guru.mataPelajaran || [],
      },
      jadwalHariIni,
      statistik: {
        totalMataPelajaran: guru.mataPelajaran ? guru.mataPelajaran.length : 0,
        totalKelas: jadwalGuru.length,
        totalSiswa,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= JADWAL & KELAS =============
exports.getJadwalGuru = async (req, res) => {
  try {
    const { tahunAjaran, semester } = req.query;
    let filter = { guru: req.user.id, isActive: true };
    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;
    if (semester) filter.semester = semester;

    const jadwal = await Jadwal.find(filter)
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
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

exports.getSiswaKelas = async (req, res) => {
  try {
    const { kelasId } = req.params;
    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      isActive: true,
    });
    if (!jadwal) {
      return res
        .status(403)
        .json({ message: "Anda tidak mengajar di kelas ini." });
    }

    const siswa = await User.find({
      kelas: kelasId,
      role: "siswa",
      isActive: true,
    })
      .select("-password")
      .sort({ name: 1 });
    res.json(siswa);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= ABSENSI =============
exports.getAbsensiBySesi = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId, tanggal } = req.query;
    if (!kelasId || !mataPelajaranId || !tanggal) {
      return res
        .status(400)
        .json({ message: "Kelas, mata pelajaran, dan tanggal wajib diisi." });
    }

    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });
    if (!jadwal) {
      return res
        .status(403)
        .json({
          message: "Anda tidak memiliki jadwal mengajar untuk kelas ini.",
        });
    }

    const absensiRecords = await Absensi.find({
      jadwal: jadwal._id,
      tanggal: tanggal,
    }).select("siswa keterangan");

    const absensiMap = new Map();
    absensiRecords.forEach((record) =>
      absensiMap.set(record.siswa.toString(), record.keterangan)
    );

    const semuaSiswa = await User.find({
      kelas: kelasId,
      role: "siswa",
      isActive: true,
    }).select("name identifier");

    const daftarHadir = semuaSiswa.map((siswa) => ({
      siswa,
      keterangan: absensiMap.get(siswa._id.toString()) || "alpa",
    }));

    res.json(daftarHadir);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= WALI KELAS =============
exports.getSiswaWaliKelas = async (req, res) => {
  try {
    const kelas = await Kelas.findOne({
      waliKelas: req.user.id,
      isActive: true,
    });
    if (!kelas) {
      return res.status(404).json({ message: "Anda bukan wali kelas aktif." });
    }
    const siswa = await User.find({
      kelas: kelas._id,
      role: "siswa",
      isActive: true,
    })
      .select("name identifier email")
      .sort({ name: 1 });

    res.json({
      kelas: {
        nama: kelas.nama,
        tingkat: kelas.tingkat,
        jurusan: kelas.jurusan,
      },
      siswa,
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= NILAI MANAGEMENT =============
exports.inputNilai = async (req, res) => {
  try {
    const {
      siswaId,
      kelasId,
      mataPelajaranId,
      jenisPenilaian,
      nilai,
      deskripsi,
      semester,
      tahunAjaran,
    } = req.body;

    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });
    if (!jadwal) {
      return res
        .status(403)
        .json({
          message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
        });
    }

    const siswa = await User.findOne({
      _id: siswaId,
      kelas: kelasId,
      role: "siswa",
      isActive: true,
    });
    if (!siswa) {
      return res
        .status(404)
        .json({ message: "Siswa tidak ditemukan di kelas ini." });
    }

    const newNilai = new Nilai({
      siswa: siswaId,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      guru: req.user.id,
      jenisPenilaian,
      nilai,
      deskripsi,
      semester,
      tahunAjaran,
    });
    await newNilai.save();

    res
      .status(201)
      .json({ message: "Nilai berhasil disimpan.", nilai: newNilai });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getNilaiSiswa = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId, semester, tahunAjaran } = req.query;

    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });
    if (!jadwal) {
      return res
        .status(403)
        .json({
          message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
        });
    }

    const nilai = await Nilai.find({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      semester,
      tahunAjaran,
    })
      .populate("siswa", "name identifier")
      .populate("mataPelajaran", "nama kode");

    res.json(nilai);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getDetailNilaiSiswa = async (req, res) => {
  try {
    const { siswaId } = req.params;

    const siswa = await User.findById(siswaId)
      .populate("kelas", "nama tingkat jurusan")
      .select("-password");
    if (!siswa || siswa.role !== "siswa") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    const nilai = await Nilai.find({ siswa: siswaId, guru: req.user.id })
      .populate("mataPelajaran", "nama kode")
      .sort({ createdAt: -1 });

    res.json({ siswa, nilai });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.exportNilai = async (req, res) => {
  try {
    // Implementasi export nilai dengan model User
    res
      .status(501)
      .json({
        message: "Fungsi export belum diimplementasikan dengan model User.",
      });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= ANALISIS KINERJA SISWA =============
exports.getAnalisisKinerjaSiswa = async (req, res) => {
  try {
    // Implementasi analisis kinerja dengan model User
    res
      .status(501)
      .json({
        message: "Fungsi analisis belum diimplementasikan dengan model User.",
      });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
