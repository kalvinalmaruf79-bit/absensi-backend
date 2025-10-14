// src/controllers/siswaController.js
const User = require("../models/User");
const Jadwal = require("../models/Jadwal");
const Tugas = require("../models/Tugas");
const Absensi = require("../models/Absensi");
const Notifikasi = require("../models/Notifikasi");
const Pengumuman = require("../models/Pengumuman");
const Materi = require("../models/Materi");
const Nilai = require("../models/Nilai");
const ActivityLog = require("../models/ActivityLog");
const mongoose = require("mongoose");

// GET /api/siswa/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id).populate(
      "kelas",
      "nama tingkat jurusan"
    );
    if (!siswa || !siswa.kelas) {
      return res.status(404).json({ message: "Siswa atau kelas tidak ada." });
    }

    const now = new Date();
    const hariIni = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ][now.getDay()];
    const jamSekarang = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const [jadwalMendatang, tugasMendatang, presensiStats] = await Promise.all([
      Jadwal.findOne({
        kelas: siswa.kelas._id,
        hari: hariIni,
        jamMulai: { $gte: jamSekarang },
        isActive: true,
      })
        .sort({ jamMulai: 1 })
        .populate("mataPelajaran", "nama")
        .populate("guru", "name"),
      Tugas.find({
        kelas: siswa.kelas._id,
        deadline: { $gte: now },
        "submissions.siswa": { $ne: siswa._id },
      })
        .sort({ deadline: 1 })
        .limit(3)
        .populate("mataPelajaran", "nama"),
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
      tugasMendatang,
      statistikPresensi: {
        hadir: statsObj.hadir || 0,
        izin: statsObj.izin || 0,
        sakit: statsObj.sakit || 0,
        alpa: statsObj.alpa || 0,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal memuat dasbor.", error: error.message });
  }
};

// GET /api/siswa/jadwal
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

// GET /api/siswa/jadwal/mendatang
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
        if (jadwalMendatang) break;
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

// GET /api/siswa/tugas/mendatang
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

// GET /api/siswa/nilai

exports.getNilaiSiswa = async (req, res) => {
  try {
    const { tahunAjaran, semester, page = 1, limit = 100 } = req.query;
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
        { path: "kelas", select: "nama tingkat jurusan" },
        { path: "tugas", select: "judul" }, // Tambahan untuk relasi tugas
      ],
    };

    const nilai = await Nilai.paginate(filter, options);
    res.json(nilai);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil nilai.",
      error: error.message,
    });
  }
};

// GET /api/siswa/nilai/statistik
// Mengambil statistik nilai per mata pelajaran untuk semester tertentu
exports.getStatistikNilai = async (req, res) => {
  try {
    const { tahunAjaran, semester } = req.query;

    if (!tahunAjaran || !semester) {
      return res.status(400).json({
        message: "Parameter tahunAjaran dan semester wajib diisi.",
      });
    }

    const statistik = await Nilai.aggregate([
      {
        $match: {
          siswa: new mongoose.Types.ObjectId(req.user.id),
          tahunAjaran,
          semester,
        },
      },
      {
        $group: {
          _id: "$mataPelajaran",
          rataRata: { $avg: "$nilai" },
          nilaiTertinggi: { $max: "$nilai" },
          nilaiTerendah: { $min: "$nilai" },
          jumlahPenilaian: { $count: {} },
          jenisNilai: {
            $push: {
              jenis: "$jenisPenilaian",
              nilai: "$nilai",
            },
          },
        },
      },
      {
        $lookup: {
          from: "matapelajarans",
          localField: "_id",
          foreignField: "_id",
          as: "mataPelajaran",
        },
      },
      {
        $unwind: "$mataPelajaran",
      },
      {
        $project: {
          _id: 0,
          mataPelajaran: {
            _id: "$mataPelajaran._id",
            nama: "$mataPelajaran.nama",
            kode: "$mataPelajaran.kode",
          },
          rataRata: { $round: ["$rataRata", 2] },
          nilaiTertinggi: 1,
          nilaiTerendah: 1,
          jumlahPenilaian: 1,
          jenisNilai: 1,
        },
      },
      {
        $sort: { "mataPelajaran.nama": 1 },
      },
    ]);

    // Hitung rata-rata keseluruhan
    const rataRataKeseluruhan =
      statistik.length > 0
        ? statistik.reduce((sum, item) => sum + item.rataRata, 0) /
          statistik.length
        : 0;

    res.json({
      tahunAjaran,
      semester,
      rataRataKeseluruhan: parseFloat(rataRataKeseluruhan.toFixed(2)),
      perMataPelajaran: statistik,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil statistik nilai.",
      error: error.message,
    });
  }
};

// GET /api/siswa/nilai/ringkasan
// Mengambil ringkasan nilai untuk semua semester yang pernah dijalani
exports.getRingkasanNilai = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id).populate("kelas");

    if (!siswa) {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    // Kumpulkan semua periode (tahun ajaran + semester) yang pernah dijalani
    const periodeSet = new Set();

    // Dari riwayat kelas
    siswa.riwayatKelas.forEach((riwayat) => {
      periodeSet.add(`${riwayat.tahunAjaran}|${riwayat.semester}`);
    });

    // Dari kelas aktif
    if (siswa.kelas && siswa.kelas.tahunAjaran) {
      periodeSet.add(`${siswa.kelas.tahunAjaran}|ganjil`);
      periodeSet.add(`${siswa.kelas.tahunAjaran}|genap`);
    }

    // Ambil nilai untuk setiap periode
    const ringkasan = [];
    for (const periode of Array.from(periodeSet)) {
      const [tahunAjaran, semester] = periode.split("|");

      const nilaiList = await Nilai.find({
        siswa: req.user.id,
        tahunAjaran,
        semester,
      }).select("nilai");

      if (nilaiList.length > 0) {
        const totalNilai = nilaiList.reduce((sum, n) => sum + n.nilai, 0);
        const rataRata = totalNilai / nilaiList.length;

        ringkasan.push({
          tahunAjaran,
          semester,
          rataRata: parseFloat(rataRata.toFixed(2)),
          jumlahNilai: nilaiList.length,
        });
      }
    }

    // Urutkan dari terbaru
    ringkasan.sort((a, b) => {
      if (a.tahunAjaran > b.tahunAjaran) return -1;
      if (a.tahunAjaran < b.tahunAjaran) return 1;
      if (a.semester > b.semester) return -1;
      if (a.semester < b.semester) return 1;
      return 0;
    });

    res.json(ringkasan);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil ringkasan nilai.",
      error: error.message,
    });
  }
};

// GET /api/siswa/teman-sekelas
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

// GET /api/siswa/notifikasi
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

// PATCH /api/siswa/notifikasi/:id/read
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

// GET /api/siswa/histori-aktivitas
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

// GET /api/siswa/mata-pelajaran
// Mengambil daftar mata pelajaran yang diajarkan di kelas siswa
exports.getMataPelajaranSiswa = async (req, res) => {
  try {
    const siswa = await User.findById(req.user.id).populate("kelas");

    if (!siswa || !siswa.kelas) {
      return res
        .status(404)
        .json({ message: "Data siswa atau kelas tidak ditemukan." });
    }

    // Cari jadwal aktif untuk kelas siswa
    const jadwalList = await Jadwal.find({
      kelas: siswa.kelas._id,
      isActive: true,
    })
      .populate("mataPelajaran", "nama kode _id")
      .select("mataPelajaran");

    // Ambil unique mata pelajaran menggunakan Map
    const mataPelajaranMap = new Map();
    jadwalList.forEach((jadwal) => {
      if (jadwal.mataPelajaran) {
        const mapel = jadwal.mataPelajaran;
        if (!mataPelajaranMap.has(mapel._id.toString())) {
          mataPelajaranMap.set(mapel._id.toString(), {
            _id: mapel._id,
            nama: mapel.nama,
            kode: mapel.kode,
          });
        }
      }
    });

    // Konversi Map menjadi array
    const mataPelajaran = Array.from(mataPelajaranMap.values());

    res.json(mataPelajaran);
  } catch (error) {
    console.error("Error getting mata pelajaran siswa:", error);
    res.status(500).json({
      message: "Gagal mengambil mata pelajaran.",
      error: error.message,
    });
  }
};

// GET /api/siswa/presensi
// Mengambil riwayat presensi siswa dengan pagination
exports.getRiwayatPresensi = async (req, res) => {
  try {
    const siswaId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    // Query absensi milik siswa ini saja
    const query = { siswa: siswaId };

    // Total documents
    const totalDocs = await Absensi.countDocuments(query);

    // Get data dengan populate
    const absensiList = await Absensi.find(query)
      .populate({
        path: "jadwal",
        populate: [
          { path: "kelas", select: "nama tingkat jurusan" },
          { path: "mataPelajaran", select: "nama kode" },
          { path: "guru", select: "name" },
        ],
      })
      .populate("siswa", "name identifier")
      .populate("sesiPresensi", "kodeUnik expiredAt")
      .populate("pengajuanAbsensi", "alasan status")
      .sort({ tanggal: -1, waktuMasuk: -1 }) // Urutkan dari terbaru
      .limit(limit)
      .skip(skip);

    // Hitung total pages
    const totalPages = Math.ceil(totalDocs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Response dengan format pagination
    res.status(200).json({
      docs: absensiList,
      totalDocs,
      limit,
      totalPages,
      page,
      pagingCounter: skip + 1,
      hasNextPage,
      hasPrevPage,
      prevPage: hasPrevPage ? page - 1 : null,
      nextPage: hasNextPage ? page + 1 : null,
    });
  } catch (error) {
    console.error("Error getting riwayat presensi siswa:", error);
    res.status(500).json({
      message: "Gagal mengambil riwayat presensi",
      error: error.message,
    });
  }
};

// GET /api/siswa/presensi/statistik
// Mengambil statistik presensi siswa
exports.getStatistikPresensi = async (req, res) => {
  try {
    const siswaId = req.user.id;
    const { tahunAjaran, semester } = req.query;

    // Build query
    const matchQuery = { siswa: new mongoose.Types.ObjectId(siswaId) };

    if (tahunAjaran || semester) {
      // Jika filter tahun/semester, join dengan jadwal
      const jadwalFilter = {};
      if (tahunAjaran) jadwalFilter.tahunAjaran = tahunAjaran;
      if (semester) jadwalFilter.semester = semester;

      const jadwalIds = await Jadwal.find(jadwalFilter).distinct("_id");
      matchQuery.jadwal = { $in: jadwalIds };
    }

    // Statistik per status
    const statistik = await Absensi.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$keterangan",
          total: { $sum: 1 },
        },
      },
    ]);

    // Format response
    const result = {
      hadir: 0,
      izin: 0,
      sakit: 0,
      alpa: 0,
    };

    statistik.forEach((stat) => {
      if (stat._id in result) {
        result[stat._id] = stat.total;
      }
    });

    // Total keseluruhan
    result.total = Object.values(result).reduce((a, b) => a + b, 0);

    // Persentase kehadiran
    if (result.total > 0) {
      result.persentaseHadir = parseFloat(
        ((result.hadir / result.total) * 100).toFixed(1)
      );
    } else {
      result.persentaseHadir = 0;
    }

    // Tambahan: Statistik per bulan (3 bulan terakhir)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const perBulan = await Absensi.aggregate([
      {
        $match: {
          siswa: new mongoose.Types.ObjectId(siswaId),
          createdAt: { $gte: threeMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            keterangan: "$keterangan",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    result.perBulan = perBulan;

    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting statistik presensi:", error);
    res.status(500).json({
      message: "Gagal mengambil statistik presensi",
      error: error.message,
    });
  }
};

// GET /api/siswa/presensi/hari-ini
// Mengambil presensi hari ini saja
exports.getPresensiHariIni = async (req, res) => {
  try {
    const siswaId = req.user.id;
    const today = new Date().toISOString().split("T")[0];

    const absensiHariIni = await Absensi.find({
      siswa: siswaId,
      tanggal: today,
    })
      .populate({
        path: "jadwal",
        populate: [
          { path: "kelas", select: "nama" },
          { path: "mataPelajaran", select: "nama kode" },
          { path: "guru", select: "name" },
        ],
      })
      .populate("sesiPresensi", "kodeUnik")
      .sort({ waktuMasuk: -1 });

    res.status(200).json(absensiHariIni);
  } catch (error) {
    console.error("Error getting presensi hari ini:", error);
    res.status(500).json({
      message: "Gagal mengambil presensi hari ini",
      error: error.message,
    });
  }
};

// GET /api/siswa/presensi/:id
// Mengambil detail presensi berdasarkan ID
exports.getDetailPresensi = async (req, res) => {
  try {
    const { id } = req.params;
    const siswaId = req.user.id;

    const absensi = await Absensi.findOne({
      _id: id,
      siswa: siswaId, // Pastikan hanya bisa akses presensi sendiri
    })
      .populate({
        path: "jadwal",
        populate: [
          { path: "kelas", select: "nama tingkat jurusan" },
          { path: "mataPelajaran", select: "nama kode" },
          { path: "guru", select: "name identifier" },
        ],
      })
      .populate("siswa", "name identifier")
      .populate("sesiPresensi", "kodeUnik lokasi expiredAt createdAt")
      .populate({
        path: "pengajuanAbsensi",
        select: "alasan status fileBukti tanggal",
      });

    if (!absensi) {
      return res.status(404).json({
        message: "Data presensi tidak ditemukan",
      });
    }

    res.status(200).json(absensi);
  } catch (error) {
    console.error("Error getting detail presensi:", error);
    res.status(500).json({
      message: "Gagal mengambil detail presensi",
      error: error.message,
    });
  }
};
