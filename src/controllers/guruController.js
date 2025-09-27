// controllers/guruController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Jadwal = require("../models/Jadwal");
const Absensi = require("../models/Absensi");
const Nilai = require("../models/Nilai");
const Kelas = require("../models/Kelas");
const Pengumuman = require("../models/Pengumuman");
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

    const [jadwalHariIni, jadwalGuru, pengumumanTerbaru] = await Promise.all([
      Jadwal.find({
        guru: guru._id,
        hari: hariIni,
        isActive: true,
      })
        .populate("kelas", "nama")
        .populate("mataPelajaran", "nama")
        .sort({ jamMulai: 1 }),
      Jadwal.find({ guru: guru._id, isActive: true }).distinct("kelas"),
      Pengumuman.find({
        isPublished: true,
        $or: [{ targetRole: "semua" }, { targetRole: "guru" }],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("pembuat", "name role"),
    ]);

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
      pengumumanTerbaru,
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
    const { kelasId, mataPelajaranId, semester, tahunAjaran } = req.query;

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

// ============= ANALISIS KINERJA SISWA (IMPLEMENTASI BARU) =============
exports.getAnalisisKinerjaSiswa = async (req, res) => {
  try {
    const { siswaId, tahunAjaran, semester } = req.query;
    if (!siswaId) {
      return res
        .status(400)
        .json({ message: "Parameter 'siswaId' wajib diisi." });
    }

    const siswa = await User.findById(siswaId);
    if (!siswa || siswa.role !== "siswa") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    // 1. Tren Nilai Rata-rata per Semester (untuk Grafik Garis)
    const trenNilai = await Nilai.aggregate([
      { $match: { siswa: new mongoose.Types.ObjectId(siswaId) } },
      {
        $group: {
          _id: { tahunAjaran: "$tahunAjaran", semester: "$semester" },
          rataRata: { $avg: "$nilai" },
        },
      },
      { $sort: { "_id.tahunAjaran": 1, "_id.semester": 1 } },
      {
        $project: {
          _id: 0,
          periode: { $concat: ["$_id.semester", " ", "$_id.tahunAjaran"] },
          rataRata: { $round: ["$rataRata", 2] },
        },
      },
    ]);

    // Jika parameter semester & tahun ajaran ada, hitung data perbandingan
    let perbandinganNilai = [];
    if (tahunAjaran && semester) {
      // 2a. Rata-rata nilai siswa per jenis penilaian
      const nilaiSiswaPerJenis = await Nilai.aggregate([
        {
          $match: {
            siswa: new mongoose.Types.ObjectId(siswaId),
            tahunAjaran: tahunAjaran,
            semester: semester,
          },
        },
        {
          $group: {
            _id: "$jenisPenilaian",
            rataRata: { $avg: "$nilai" },
          },
        },
      ]);

      // 2b. Rata-rata nilai kelas per jenis penilaian
      const nilaiKelasPerJenis = await Nilai.aggregate([
        {
          $match: {
            kelas: siswa.kelas, // Mengambil kelas aktif siswa
            tahunAjaran: tahunAjaran,
            semester: semester,
          },
        },
        {
          $group: {
            _id: "$jenisPenilaian",
            rataRata: { $avg: "$nilai" },
          },
        },
      ]);

      // Gabungkan data untuk perbandingan (untuk Grafik Radar/Batang)
      const mapKelas = new Map(
        nilaiKelasPerJenis.map((item) => [item._id, item.rataRata])
      );
      perbandinganNilai = nilaiSiswaPerJenis.map((item) => ({
        jenisPenilaian: item._id,
        nilaiSiswa: Math.round(item.rataRata * 100) / 100,
        rataRataKelas: Math.round((mapKelas.get(item._id) || 0) * 100) / 100,
      }));
    }

    res.json({
      message: `Analisis Kinerja untuk ${siswa.name}`,
      data: {
        trenNilai,
        perbandinganNilai,
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
