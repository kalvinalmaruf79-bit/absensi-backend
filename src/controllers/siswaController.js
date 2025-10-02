// controllers/siswaController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Nilai = require("../models/Nilai");
const Jadwal = require("../models/Jadwal");
const Absensi = require("../models/Absensi");
const Notifikasi = require("../models/Notifikasi");
const Tugas = require("../models/Tugas");
const ActivityLog = require("../models/ActivityLog"); // Impor model baru

/**
 * @summary Mengambil histori aktivitas siswa dengan pagination
 */
exports.getHistoriAktivitas = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const query = { user: req.user.id };
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
    };

    const histori = await ActivityLog.paginate(query, options);
    res.json(histori);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil histori aktivitas.",
      error: error.message,
    });
  }
};

exports.getJadwalByTanggal = async (req, res) => {
  try {
    const { tanggal } = req.query;
    if (!tanggal) {
      return res
        .status(400)
        .json({ message: "Parameter tanggal wajib diisi." });
    }

    const date = new Date(tanggal);
    const dayOfWeek = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ][date.getUTCDay()];

    const siswa = await User.findById(req.user.id);
    if (!siswa || !siswa.kelas) {
      return res.status(404).json({ message: "Siswa atau kelas tidak ada." });
    }

    const jadwalHariItu = await Jadwal.find({
      kelas: siswa.kelas,
      hari: dayOfWeek,
      isActive: true,
    })
      .populate("mataPelajaran", "nama")
      .sort({ jamMulai: 1 });

    res.json(jadwalHariItu);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil jadwal.", error: error.message });
  }
};

exports.getTugasMendatang = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id);
    if (!siswa || !siswa.kelas) {
      return res
        .status(404)
        .json({ message: "Data siswa atau kelas tidak ditemukan." });
    }

    const { limit = 5 } = req.query;

    const tugasMendatang = await Tugas.find({
      kelas: siswa.kelas,
      deadline: { $gte: new Date() },
      "submissions.siswa": { $ne: siswa._id },
    })
      .sort({ deadline: 1 })
      .limit(parseInt(limit))
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name");

    res.json(tugasMendatang);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil tugas mendatang.",
      error: error.message,
    });
  }
};

exports.getJadwalMendatang = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id);
    if (!siswa || !siswa.kelas) {
      return res
        .status(404)
        .json({ message: "Data siswa atau kelas tidak ditemukan." });
    }

    const now = new Date();
    const hariIniIndex = now.getDay();
    const jamSekarang = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const daftarHari = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ];
    const hariIniNama = daftarHari[hariIniIndex];

    let jadwalMendatang = await Jadwal.findOne({
      kelas: siswa.kelas,
      hari: hariIniNama,
      jamMulai: { $gte: jamSekarang },
      isActive: true,
    })
      .sort({ jamMulai: 1 })
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name");

    if (!jadwalMendatang) {
      for (let i = 1; i <= 6; i++) {
        const hariBerikutnyaIndex = (hariIniIndex + i) % 7;
        const hariBerikutnyaNama = daftarHari[hariBerikutnyaIndex];

        jadwalMendatang = await Jadwal.findOne({
          kelas: siswa.kelas,
          hari: hariBerikutnyaNama,
          isActive: true,
        })
          .sort({ jamMulai: 1 })
          .populate("mataPelajaran", "nama kode")
          .populate("guru", "name");

        if (jadwalMendatang) {
          break;
        }
      }
    }

    res.json({ jadwalMendatang: jadwalMendatang || null });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil jadwal mendatang.",
      error: error.message,
    });
  }
};

/**
 * @summary Mengambil notifikasi siswa dengan pagination
 */
exports.getNotifikasi = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { penerima: req.user.id };
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
    };
    const notifikasi = await Notifikasi.paginate(query, options);
    res.json(notifikasi);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil notifikasi." });
  }
};

exports.markNotifikasiAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = { penerima: req.user.id, isRead: false };

    if (id !== "all") {
      filter._id = id;
    }

    const result = await Notifikasi.updateMany(filter, {
      $set: { isRead: true },
    });
    res.json({
      message: `${result.modifiedCount} notifikasi ditandai telah dibaca.`,
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal memperbarui status notifikasi." });
  }
};

// --- FUNGSI DASHBOARD DIPERBARUI ---
exports.getDashboard = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id).populate(
      "kelas",
      "nama tingkat jurusan"
    );
    if (!siswa || siswa.role !== "siswa") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    // Mengambil semua data secara paralel untuk performa lebih baik
    const [jadwalMendatang, tugasMendatang, presensiStats] = await Promise.all([
      // Jadwal terdekat yang akan datang
      Jadwal.findOne({
        kelas: siswa.kelas._id,
        hari: ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"][
          new Date().getDay()
        ],
        jamMulai: {
          $gte: `${new Date()
            .getHours()
            .toString()
            .padStart(2, "0")}:${new Date()
            .getMinutes()
            .toString()
            .padStart(2, "0")}`,
        },
        isActive: true,
      })
        .sort({ jamMulai: 1 })
        .populate("mataPelajaran", "nama kode")
        .populate("guru", "name"),

      // 3 tugas terdekat yang belum dikumpulkan
      Tugas.find({
        kelas: siswa.kelas._id,
        deadline: { $gte: new Date() },
        "submissions.siswa": { $ne: siswa._id },
      })
        .sort({ deadline: 1 })
        .limit(3)
        .populate("mataPelajaran", "nama"),

      // Agregasi statistik presensi bulan ini
      Absensi.aggregate([
        {
          $match: {
            siswa: new mongoose.Types.ObjectId(req.user.id),
            createdAt: {
              $gte: new Date(new Date().setDate(1)),
              $lte: new Date(),
            },
          },
        },
        { $group: { _id: "$keterangan", count: { $sum: 1 } } },
      ]),
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
      jadwalMendatang: jadwalMendatang || null,
      tugasMendatang, // Menambahkan data tugas ke response
      statistikPresensi: {
        // Data ini siap dibuat grafik lingkaran
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
// ------------------------------------

exports.getJadwalSiswa = async (req, res) => {
  try {
    const { tahunAjaran, semester } = req.query;
    const siswa = await User.findById(req.user.id);

    if (!siswa || siswa.role !== "siswa") {
      return res.status(400).json({ message: "Siswa tidak ditemukan." });
    }
    if (!siswa.kelas && siswa.riwayatKelas.length === 0) {
      return res.status(400).json({ message: "Siswa belum memiliki kelas." });
    }

    let filter = { isActive: true };

    if (tahunAjaran && semester) {
      const riwayat = siswa.riwayatKelas.find(
        (r) => r.tahunAjaran === tahunAjaran && r.semester === semester
      );
      if (riwayat) {
        filter.kelas = riwayat.kelas;
      } else {
        filter.kelas = siswa.kelas;
      }
      filter.tahunAjaran = tahunAjaran;
      filter.semester = semester;
    } else {
      filter.kelas = siswa.kelas;
    }

    if (!filter.kelas) {
      return res.json({
        senin: [],
        selasa: [],
        rabu: [],
        kamis: [],
        jumat: [],
        sabtu: [],
      });
    }

    const jadwal = await Jadwal.find(filter)
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

exports.getNilaiSiswa = async (req, res) => {
  try {
    const { tahunAjaran, semester, page = 1, limit = 100 } = req.query; // Limit tinggi untuk 'semua' nilai per semester
    let filter = { siswa: req.user.id };

    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;
    if (semester) filter.semester = semester;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { tanggalPenilaian: -1 },
      populate: [
        { path: "mataPelajaran", select: "nama kode" },
        { path: "guru", select: "name" },
      ],
    };

    const nilai = await Nilai.paginate(filter, options);
    res.json(nilai);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

/**
 * @summary Mengambil riwayat presensi siswa dengan pagination
 */
exports.getRiwayatPresensi = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const query = { siswa: req.user.id };
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: {
        path: "jadwal",
        populate: {
          path: "mataPelajaran guru kelas",
          select: "nama kode name tingkat jurusan",
        },
      },
    };

    const presensi = await Absensi.paginate(query, options);
    res.json(presensi);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

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
