// controllers/siswaController.js
const mongoose = require("mongoose");
const Siswa = require("../models/Siswa");
const Nilai = require("../models/Nilai");
const Jadwal = require("../models/Jadwal");
const Absensi = require("../models/Absensi");

// Dashboard siswa
exports.getDashboard = async (req, res) => {
  try {
    const siswaId = req.user.id;

    const siswa = await Siswa.findById(siswaId).populate(
      "kelas",
      "nama tingkat jurusan"
    );

    if (!siswa) {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    if (!siswa.kelas) {
      return res.status(400).json({ message: "Siswa belum memiliki kelas." });
    }

    // Get jadwal hari ini
    const today = new Date();
    const hariIni = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ][today.getDay()];

    const jadwalHariIni = await Jadwal.find({
      kelas: siswa.kelas._id,
      hari: hariIni,
      isActive: true,
    })
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name")
      .sort({ jamMulai: 1 });

    // Get nilai terbaru
    const nilaiTerbaru = await Nilai.find({
      siswa: siswaId,
    })
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    // Get statistik presensi bulan ini
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
          siswa: new mongoose.Types.ObjectId(siswaId),
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: "$keterangan",
          count: { $sum: 1 },
        },
      },
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
    console.error("Error getting siswa dashboard:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get jadwal siswa
exports.getJadwalSiswa = async (req, res) => {
  try {
    const siswaId = req.user.id;
    const { tahunAjaran, semester } = req.query;

    const siswa = await Siswa.findById(siswaId);
    if (!siswa || !siswa.kelas) {
      return res
        .status(400)
        .json({ message: "Siswa tidak ditemukan atau belum memiliki kelas." });
    }

    let filter = {
      kelas: siswa.kelas,
      isActive: true,
    };

    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;
    if (semester) filter.semester = semester;

    const jadwal = await Jadwal.find(filter)
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier")
      .sort({ hari: 1, jamMulai: 1 });

    // Group by hari
    const jadwalPerHari = {
      senin: [],
      selasa: [],
      rabu: [],
      kamis: [],
      jumat: [],
      sabtu: [],
    };

    jadwal.forEach((j) => {
      if (jadwalPerHari[j.hari]) {
        jadwalPerHari[j.hari].push(j);
      }
    });

    res.json(jadwalPerHari);
  } catch (error) {
    console.error("Error getting jadwal siswa:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get nilai siswa
exports.getNilaiSiswa = async (req, res) => {
  try {
    const siswaId = req.user.id;
    const { mataPelajaranId, semester, tahunAjaran, jenisPenilaian } =
      req.query;

    let filter = { siswa: siswaId };

    if (mataPelajaranId) filter.mataPelajaran = mataPelajaranId;
    if (semester) filter.semester = semester;
    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;
    if (jenisPenilaian) filter.jenisPenilaian = jenisPenilaian;

    const nilai = await Nilai.find(filter)
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name")
      .sort({ mataPelajaran: 1, jenisPenilaian: 1, createdAt: -1 });

    // Group by mata pelajaran
    const nilaiPerMapel = {};
    nilai.forEach((n) => {
      const mapelId = n.mataPelajaran._id.toString();
      if (!nilaiPerMapel[mapelId]) {
        nilaiPerMapel[mapelId] = {
          mataPelajaran: n.mataPelajaran,
          guru: n.guru,
          nilai: {},
        };
      }
      nilaiPerMapel[mapelId].nilai[n.jenisPenilaian] = {
        nilai: n.nilai,
        deskripsi: n.deskripsi,
        tanggalPenilaian: n.tanggalPenilaian,
      };
    });

    res.json(Object.values(nilaiPerMapel));
  } catch (error) {
    console.error("Error getting nilai siswa:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get riwayat presensi siswa
exports.getRiwayatPresensi = async (req, res) => {
  try {
    const siswaId = req.user.id;
    const { tanggalMulai, tanggalSelesai, keterangan } = req.query;

    let filter = { siswa: siswaId };

    if (tanggalMulai && tanggalSelesai) {
      filter.createdAt = {
        $gte: new Date(tanggalMulai),
        $lte: new Date(tanggalSelesai),
      };
    }

    if (keterangan) filter.keterangan = keterangan;

    const presensi = await Absensi.find(filter)
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
    console.error("Error getting riwayat presensi:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get teman sekelas
exports.getTemanSekelas = async (req, res) => {
  try {
    const siswaId = req.user.id;

    const siswa = await Siswa.findById(siswaId);
    if (!siswa || !siswa.kelas) {
      return res
        .status(400)
        .json({ message: "Siswa tidak ditemukan atau belum memiliki kelas." });
    }

    const temanSekelas = await Siswa.find({
      kelas: siswa.kelas,
      _id: { $ne: siswaId }, // Exclude diri sendiri
      isActive: true,
    })
      .populate("kelas", "nama tingkat jurusan")
      .select("name identifier")
      .sort({ name: 1 });

    res.json(temanSekelas);
  } catch (error) {
    console.error("Error getting teman sekelas:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
