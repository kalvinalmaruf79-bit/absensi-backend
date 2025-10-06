// controllers/guruController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Jadwal = require("../models/Jadwal");
const Absensi = require("../models/Absensi");
const Nilai = require("../models/Nilai");
const Kelas = require("../models/Kelas");
const Pengumuman = require("../models/Pengumuman");
const MataPelajaran = require("../models/MataPelajaran");
const ActivityLog = require("../models/ActivityLog");
const Settings = require("../models/Settings"); // <-- 1. IMPORT MODEL SETTINGS
const ExcelJS = require("exceljs");
const logActivity = require("../middleware/activityLogger");

// ============= DASHBOARD & PROFILE (IMPROVED) =============
exports.getDashboard = async (req, res) => {
  try {
    // --- PERUBAHAN UTAMA: Ambil pengaturan global terlebih dahulu ---
    const settings = await Settings.getSettings();
    const { tahunAjaranAktif, semesterAktif } = settings;
    // -----------------------------------------------------------

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

    const [jadwalHariIni, jadwalGuru, pengumumanTerbaru, rekapAbsensiBulanIni] =
      await Promise.all([
        // PERUBAHAN: Filter jadwal hari ini berdasarkan periode aktif
        Jadwal.find({
          guru: guru._id,
          hari: hariIni,
          isActive: true,
          tahunAjaran: tahunAjaranAktif,
          semester: semesterAktif,
        })
          .populate("kelas", "nama")
          .populate("mataPelajaran", "nama")
          .sort({ jamMulai: 1 }),
        // PERUBAHAN: Ambil kelas yang diajar pada periode aktif
        Jadwal.find({
          guru: guru._id,
          isActive: true,
          tahunAjaran: tahunAjaranAktif,
          semester: semesterAktif,
        }).distinct("kelas"),
        Pengumuman.find({
          isPublished: true,
          $or: [{ targetRole: "semua" }, { targetRole: "guru" }],
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("pembuat", "name role"),
        // PERUBAHAN: Filter rekap absensi berdasarkan periode aktif
        Absensi.aggregate([
          {
            $lookup: {
              from: "jadwals",
              localField: "jadwal",
              foreignField: "_id",
              as: "jadwalInfo",
            },
          },
          { $unwind: "$jadwalInfo" },
          {
            $match: {
              "jadwalInfo.guru": guru._id,
              "jadwalInfo.tahunAjaran": tahunAjaranAktif,
              "jadwalInfo.semester": semesterAktif,
              createdAt: {
                $gte: new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  1
                ),
              },
            },
          },
          { $group: { _id: "$keterangan", count: { $sum: 1 } } },
        ]),
      ]);

    const totalSiswa = await User.countDocuments({
      role: "siswa",
      kelas: { $in: jadwalGuru },
      isActive: true,
    });

    const statsAbsensi = {};
    rekapAbsensiBulanIni.forEach((stat) => {
      statsAbsensi[stat._id] = stat.count;
    });

    res.json({
      guru: {
        name: guru.name,
        identifier: guru.identifier,
        mataPelajaran: guru.mataPelajaran || [],
      },
      jadwalHariIni,
      pengumumanTerbaru,
      statistik: {
        totalMataPelajaran: guru.mataPelajaran ? guru.mataPelajaran.length : 0,
        totalKelas: jadwalGuru.length,
        totalSiswa,
        absensiBulanIni: {
          hadir: statsAbsensi.hadir || 0,
          izin: statsAbsensi.izin || 0,
          sakit: statsAbsensi.sakit || 0,
          alpa: statsAbsensi.alpa || 0,
        },
      },
      settings: {
        // Kirim juga info settings ke frontend
        tahunAjaranAktif,
        semesterAktif,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.getKelasDiampu = async (req, res) => {
  try {
    const guruId = req.user.id;
    const kelasIds = await Jadwal.find({
      guru: guruId,
      isActive: true,
    })
      .distinct("kelas")
      .exec();
    const kelasList = await Kelas.find({
      _id: { $in: kelasIds },
      isActive: true,
    })
      .select("nama tingkat jurusan")
      .sort({ tingkat: 1, nama: 1 });
    res.json(kelasList);
  } catch (error) {
    console.error("Error getKelasDiampu:", error);
    res.status(500).json({
      message: "Gagal mengambil data kelas yang diampu.",
      error: error.message,
    });
  }
};

exports.getMataPelajaranDiampu = async (req, res) => {
  try {
    const guruId = req.user.id;
    const mataPelajaranIds = await Jadwal.find({
      guru: guruId,
      isActive: true,
    })
      .distinct("mataPelajaran")
      .exec();
    const mataPelajaranList = await MataPelajaran.find({
      _id: { $in: mataPelajaranIds },
    })
      .select("nama kode")
      .sort({ nama: 1 });
    res.json(mataPelajaranList);
  } catch (error) {
    console.error("Error getMataPelajaranDiampu:", error);
    res.status(500).json({
      message: "Gagal mengambil data mata pelajaran yang diampu.",
      error: error.message,
    });
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
    const { page = 1, limit = 100, search } = req.query;
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
    let query = {
      kelas: kelasId,
      role: "siswa",
      isActive: true,
    };
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ name: searchRegex }, { identifier: searchRegex }];
    }
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      select: "-password",
      sort: { name: 1 },
      populate: {
        path: "kelas",
        select: "nama tingkat jurusan",
      },
    };
    const result = await User.paginate(query, options);
    res.json(result);
  } catch (error) {
    console.error("Error getSiswaKelas:", error);
    res.status(500).json({
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.getRekapNilaiKelas = async (req, res) => {
  try {
    const { kelasId } = req.params;
    const {
      mataPelajaranId,
      semester,
      tahunAjaran,
      export: exportToExcel,
    } = req.query;
    if (!mataPelajaranId || !semester || !tahunAjaran) {
      return res.status(400).json({
        message:
          "Query mataPelajaranId, semester, dan tahunAjaran wajib diisi.",
      });
    }
    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });
    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
      });
    }
    const pipeline = [
      {
        $match: {
          kelas: new mongoose.Types.ObjectId(kelasId),
          mataPelajaran: new mongoose.Types.ObjectId(mataPelajaranId),
          semester: semester,
          tahunAjaran: tahunAjaran,
        },
      },
      {
        $group: {
          _id: {
            siswa: "$siswa",
            jenis: "$jenisPenilaian",
          },
          avgNilai: { $avg: "$nilai" },
        },
      },
      {
        $group: {
          _id: "$_id.siswa",
          rekap: {
            $push: {
              k: "$_id.jenis",
              v: "$avgNilai",
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "siswaInfo",
        },
      },
      { $unwind: "$siswaInfo" },
      {
        $project: {
          _id: 0,
          siswaId: "$_id",
          nama: "$siswaInfo.name",
          identifier: "$siswaInfo.identifier",
          nilai: { $arrayToObject: "$rekap" },
        },
      },
      { $sort: { nama: 1 } },
    ];
    const rekapData = await Nilai.aggregate(pipeline);
    if (exportToExcel === "true") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Rekap Nilai");
      const columns = [
        { header: "Nama Siswa", key: "nama", width: 30 },
        { header: "NIS", key: "identifier", width: 20 },
      ];
      const jenisPenilaian = [
        ...new Set(rekapData.flatMap((d) => Object.keys(d.nilai))),
      ];
      jenisPenilaian.forEach((jenis) => {
        columns.push({
          header: `Rata-rata ${jenis}`,
          key: jenis,
          width: 20,
        });
      });
      worksheet.columns = columns;
      rekapData.forEach((item) => {
        const rowData = {
          nama: item.nama,
          identifier: item.identifier,
        };
        jenisPenilaian.forEach((jenis) => {
          rowData[jenis] = item.nilai[jenis]
            ? item.nilai[jenis].toFixed(2)
            : "N/A";
        });
        worksheet.addRow(rowData);
      });
      const kelasInfo = await Kelas.findById(kelasId).select("nama");
      const fileName = `Rekap-Nilai-${kelasInfo.nama.replace(
        /\s+/g,
        "-"
      )}-${semester}-${tahunAjaran.replace("/", "-")}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      await workbook.xlsx.write(res);
      return res.status(200).end();
    }
    res.json(rekapData);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil rekapitulasi nilai.",
      error: error.message,
    });
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

    // Validasi jadwal
    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });

    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak memiliki jadwal mengajar untuk kelas ini.",
      });
    }

    // Ambil SEMUA siswa di kelas
    const semuaSiswa = await User.find({
      kelas: kelasId,
      role: "siswa",
      isActive: true,
    })
      .select("name identifier")
      .sort({ name: 1 });

    // Ambil data absensi yang sudah ada untuk tanggal ini
    const absensiRecords = await Absensi.find({
      jadwal: jadwal._id,
      tanggal: tanggal,
    }).select("siswa keterangan waktuMasuk");

    // Buat map untuk lookup cepat
    const absensiMap = new Map();
    absensiRecords.forEach((record) => {
      absensiMap.set(record.siswa.toString(), {
        _id: record._id, // Tambahkan ID untuk update
        keterangan: record.keterangan,
        waktuMasuk: record.waktuMasuk,
      });
    });

    // Gabungkan data siswa dengan status absensi
    const daftarHadir = semuaSiswa.map((siswa) => {
      const absensiData = absensiMap.get(siswa._id.toString());
      return {
        _id: absensiData?._id || null, // ID absensi (null jika belum ada)
        siswa: {
          _id: siswa._id,
          name: siswa.name,
          identifier: siswa.identifier,
        },
        keterangan: absensiData?.keterangan || "alpa",
        waktuMasuk: absensiData?.waktuMasuk || null,
      };
    });

    res.json(daftarHadir);
  } catch (error) {
    console.error("Error getAbsensiBySesi:", error);
    res.status(500).json({
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
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

// ============= NILAI MANAGEMENT (IMPROVED) =============
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
      return res.status(403).json({
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

exports.inputNilaiMassal = async (req, res) => {
  try {
    const {
      kelasId,
      mataPelajaranId,
      jenisPenilaian,
      semester,
      tahunAjaran,
      nilaiSiswa,
    } = req.body;
    if (
      !kelasId ||
      !mataPelajaranId ||
      !jenisPenilaian ||
      !semester ||
      !tahunAjaran ||
      !nilaiSiswa
    ) {
      return res.status(400).json({ message: "Semua field wajib diisi." });
    }
    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });
    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
      });
    }
    const operasiNilai = nilaiSiswa.map((item) => ({
      updateOne: {
        filter: {
          siswa: item.siswaId,
          mataPelajaran: mataPelajaranId,
          jenisPenilaian: jenisPenilaian,
          semester: semester,
          tahunAjaran: tahunAjaran,
        },
        update: {
          $set: {
            nilai: item.nilai,
            deskripsi: item.deskripsi,
            guru: req.user.id,
            kelas: kelasId,
          },
        },
        upsert: true,
      },
    }));
    if (operasiNilai.length > 0) {
      await Nilai.bulkWrite(operasiNilai);
    }
    res.status(200).json({ message: "Semua nilai berhasil disimpan." });
  } catch (error) {
    console.error("Error input nilai massal:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getNilaiSiswa = async (req, res) => {
  try {
    const {
      kelasId,
      mataPelajaranId,
      jenisPenilaian, // Tambahkan parameter ini
      semester,
      tahunAjaran,
      page = 1,
      limit = 10,
    } = req.query;

    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });

    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
      });
    }

    const query = {
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      semester,
      tahunAjaran,
    };

    // Tambahkan filter jenis penilaian jika ada
    if (jenisPenilaian) {
      query.jenisPenilaian = jenisPenilaian;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: [
        { path: "siswa", select: "name identifier" },
        { path: "mataPelajaran", select: "nama kode" },
      ],
    };

    const result = await Nilai.paginate(query, options);
    res.json(result);
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
    const { kelasId, mataPelajaranId, semester, tahunAjaran } = req.query;
    if (!kelasId || !mataPelajaranId || !semester || !tahunAjaran) {
      return res.status(400).json({
        message:
          "Semua parameter query (kelasId, mataPelajaranId, semester, tahunAjaran) wajib diisi.",
      });
    }
    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      isActive: true,
    });
    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
      });
    }
    const nilai = await Nilai.find({
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      semester,
      tahunAjaran,
    })
      .populate("siswa", "name identifier")
      .populate("mataPelajaran", "nama")
      .populate("kelas", "nama");
    if (nilai.length === 0) {
      return res
        .status(404)
        .json({ message: "Tidak ada data nilai untuk diekspor." });
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Daftar Nilai");
    worksheet.columns = [
      { header: "Nama Siswa", key: "nama", width: 25 },
      { header: "NIS", key: "nis", width: 20 },
      { header: "Jenis Penilaian", key: "jenis", width: 20 },
      { header: "Nilai", key: "nilai", width: 10 },
      { header: "Deskripsi", key: "deskripsi", width: 30 },
      { header: "Tanggal", key: "tanggal", width: 15 },
    ];
    nilai.forEach((item) => {
      worksheet.addRow({
        nama: item.siswa.name,
        nis: item.siswa.identifier,
        jenis: item.jenisPenilaian,
        nilai: item.nilai,
        deskripsi: item.deskripsi,
        tanggal: new Date(item.tanggalPenilaian).toLocaleDateString("id-ID"),
      });
    });
    const mapel = nilai[0]?.mataPelajaran.nama || "Nilai";
    const kelas = nilai[0]?.kelas.nama || "Kelas";
    const fileName = `Nilai_${mapel.replace(/\s+/g, "-")}_${kelas.replace(
      /\s+/g,
      "-"
    )}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error exporting nilai:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat mengekspor nilai." });
  }
};

exports.updateNilai = [
  logActivity("UPDATE_NILAI", (req) => `Mengubah nilai ID: ${req.params.id}.`),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { nilai, deskripsi } = req.body;
      if (nilai === undefined) {
        return res.status(400).json({ message: "Nilai wajib diisi." });
      }
      const nilaiRecord = await Nilai.findOneAndUpdate(
        { _id: id, guru: req.user.id },
        { $set: { nilai, deskripsi } },
        { new: true, runValidators: true }
      );
      if (!nilaiRecord) {
        return res.status(404).json({
          message: "Data nilai tidak ditemukan atau Anda tidak memiliki akses.",
        });
      }
      res.json({ message: "Nilai berhasil diperbarui.", data: nilaiRecord });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Gagal memperbarui nilai.", error: error.message });
    }
  },
];

exports.deleteNilai = [
  logActivity("DELETE_NILAI", (req) => `Menghapus nilai ID: ${req.params.id}.`),
  async (req, res) => {
    try {
      const { id } = req.params;
      const nilaiRecord = await Nilai.findOneAndDelete({
        _id: id,
        guru: req.user.id,
      });
      if (!nilaiRecord) {
        return res.status(404).json({
          message: "Data nilai tidak ditemukan atau Anda tidak memiliki akses.",
        });
      }
      res.json({ message: "Nilai berhasil dihapus." });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Gagal menghapus nilai.", error: error.message });
    }
  },
];

exports.getNilaiStats = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId, semester, tahunAjaran } = req.query;
    if (!kelasId || !mataPelajaranId || !semester || !tahunAjaran) {
      return res.status(400).json({ message: "Semua parameter wajib diisi." });
    }
    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    });
    if (!jadwal) {
      return res
        .status(403)
        .json({ message: "Anda tidak mengajar di kelas ini." });
    }
    const stats = await Nilai.aggregate([
      {
        $match: {
          kelas: new mongoose.Types.ObjectId(kelasId),
          mataPelajaran: new mongoose.Types.ObjectId(mataPelajaranId),
          semester: semester,
          tahunAjaran: tahunAjaran,
        },
      },
      {
        $group: {
          _id: null,
          totalNilai: { $sum: 1 },
          rataRata: { $avg: "$nilai" },
          siswaTuntas: {
            $sum: { $cond: [{ $gte: ["$nilai", 75] }, 1, 0] },
          },
        },
      },
    ]);
    const result = stats[0] || {
      totalNilai: 0,
      rataRata: 0,
      siswaTuntas: 0,
    };
    res.json({
      totalNilaiTerinput: result.totalNilai,
      rataRataKelas: parseFloat(result.rataRata.toFixed(2)),
      siswaTuntas: result.siswaTuntas,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil statistik nilai.",
      error: error.message,
    });
  }
};

// ============= ANALISIS KINERJA SISWA (IMPLEMENTASI BARU & LENGKAP) =============
exports.getAnalisisKinerjaSiswa = async (req, res) => {
  try {
    const { siswaId, tahunAjaran, semester } = req.query;
    if (!siswaId || !tahunAjaran || !semester) {
      return res.status(400).json({
        message:
          "Parameter 'siswaId', 'tahunAjaran', dan 'semester' wajib diisi.",
      });
    }

    const siswa = await User.findById(siswaId);
    if (!siswa || siswa.role !== "siswa" || !siswa.kelas) {
      return res
        .status(404)
        .json({ message: "Siswa tidak ditemukan atau tidak memiliki kelas." });
    }

    const isMengajar = await Jadwal.findOne({
      guru: req.user.id,
      kelas: siswa.kelas,
    });
    if (!isMengajar && req.user.role !== "super_admin") {
      return res
        .status(403)
        .json({ message: "Anda tidak memiliki akses ke data siswa ini." });
    }

    const objectIdSiswa = new mongoose.Types.ObjectId(siswaId);
    const objectIdKelas = new mongoose.Types.ObjectId(siswa.kelas);

    const [nilaiSiswa, nilaiKelas, absensiSiswa] = await Promise.all([
      Nilai.find({ siswa: objectIdSiswa, tahunAjaran, semester }).populate(
        "mataPelajaran",
        "nama"
      ),
      Nilai.find({ kelas: objectIdKelas, tahunAjaran, semester }),
      Absensi.aggregate([
        {
          $match: {
            siswa: objectIdSiswa,
            tanggal: { $regex: tahunAjaran.substring(0, 4) },
          },
        },
        { $group: { _id: "$keterangan", count: { $sum: 1 } } },
      ]),
    ]);

    const totalNilaiSiswa = nilaiSiswa.reduce(
      (acc, curr) => acc + curr.nilai,
      0
    );
    const rataRataSiswa =
      nilaiSiswa.length > 0 ? totalNilaiSiswa / nilaiSiswa.length : 0;

    const analisisPerMapel = {};

    nilaiSiswa.forEach((n) => {
      const mapelId = n.mataPelajaran._id.toString();
      if (!analisisPerMapel[mapelId]) {
        analisisPerMapel[mapelId] = {
          namaMapel: n.mataPelajaran.nama,
          nilaiSiswa: [],
          rataRataSiswa: 0,
          rataRataKelas: 0,
        };
      }
      analisisPerMapel[mapelId].nilaiSiswa.push(n.nilai);
    });

    const nilaiKelasPerMapel = {};
    nilaiKelas.forEach((n) => {
      const mapelId = n.mataPelajaran.toString();
      if (!nilaiKelasPerMapel[mapelId]) {
        nilaiKelasPerMapel[mapelId] = [];
      }
      nilaiKelasPerMapel[mapelId].push(n.nilai);
    });

    for (const mapelId in analisisPerMapel) {
      const siswaScores = analisisPerMapel[mapelId].nilaiSiswa;
      analisisPerMapel[mapelId].rataRataSiswa =
        siswaScores.reduce((a, b) => a + b, 0) / siswaScores.length;

      const kelasScores = nilaiKelasPerMapel[mapelId] || [];
      if (kelasScores.length > 0) {
        analisisPerMapel[mapelId].rataRataKelas =
          kelasScores.reduce((a, b) => a + b, 0) / kelasScores.length;
      }
    }

    const rekapAbsensi = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
    absensiSiswa.forEach((item) => {
      if (rekapAbsensi.hasOwnProperty(item._id)) {
        rekapAbsensi[item._id] = item.count;
      }
    });

    res.json({
      message: `Analisis Kinerja untuk ${siswa.name}`,
      data: {
        infoSiswa: {
          nama: siswa.name,
          nis: siswa.identifier,
        },
        periode: {
          tahunAjaran,
          semester,
        },
        kinerjaUmum: {
          rataRataSiswa: parseFloat(rataRataSiswa.toFixed(2)),
          totalNilaiDiinput: nilaiSiswa.length,
        },
        analisisPerMapel: Object.values(analisisPerMapel).map((item) => ({
          ...item,
          rataRataSiswa: parseFloat(item.rataRataSiswa.toFixed(2)),
          rataRataKelas: parseFloat(item.rataRataKelas.toFixed(2)),
        })),
        rekapAbsensi,
      },
    });
  } catch (error) {
    console.error("Error getting analisis kinerja:", error);
    res.status(500).json({
      message: "Gagal mengambil data analisis kinerja.",
      error: error.message,
    });
  }
};

// ============= HISTORI AKTIVITAS SISWA =============
exports.getHistoriAktivitasSiswa = async (req, res) => {
  try {
    const { siswaId } = req.params;
    const { page = 1, limit = 15 } = req.query;
    const siswa = await User.findById(siswaId);
    if (!siswa || siswa.role !== "siswa") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }
    const isMengajar = await Jadwal.findOne({
      guru: req.user.id,
      kelas: siswa.kelas,
      isActive: true,
    });
    if (!isMengajar && req.user.role !== "super_admin") {
      return res
        .status(403)
        .json({ message: "Anda tidak memiliki akses ke histori siswa ini." });
    }
    const query = { user: siswaId };
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
    };
    const histori = await ActivityLog.paginate(query, options);
    res.json(histori);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil histori aktivitas siswa.",
      error: error.message,
    });
  }
};
