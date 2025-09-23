// controllers/guruController.js
const mongoose = require("mongoose");
const Guru = require("../models/Guru");
const Siswa = require("../models/Siswa");
const MataPelajaran = require("../models/MataPelajaran");
const Kelas = require("../models/Kelas");
const Jadwal = require("../models/Jadwal");
const Nilai = require("../models/Nilai");
const Absensi = require("../models/Absensi");
const ExcelJS = require("exceljs");

// ============= DASHBOARD & PROFILE =============

// Dashboard guru
exports.getDashboard = async (req, res) => {
  try {
    const guruId = req.user.id;

    // Get guru data dengan mata pelajaran
    const guru = await Guru.findById(guruId).populate(
      "mataPelajaran",
      "nama kode"
    );

    if (!guru) {
      return res.status(404).json({ message: "Guru tidak ditemukan." });
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
      guru: guruId,
      hari: hariIni,
      isActive: true,
    })
      .populate("kelas", "nama")
      .populate("mataPelajaran", "nama")
      .sort({ jamMulai: 1 });

    // Get statistik siswa dari kelas yang diajar
    const jadwalGuru = await Jadwal.find({
      guru: guruId,
      isActive: true,
    }).distinct("kelas");
    const totalSiswa = await Siswa.countDocuments({
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
    console.error("Error getting guru dashboard:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get jadwal guru
exports.getJadwalGuru = async (req, res) => {
  try {
    const { tahunAjaran, semester } = req.query;

    let filter = {
      guru: req.user.id,
      isActive: true,
    };

    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;
    if (semester) filter.semester = semester;

    const jadwal = await Jadwal.find(filter)
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
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
    console.error("Error getting jadwal guru:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get siswa dari kelas yang diajar
exports.getSiswaKelas = async (req, res) => {
  try {
    const { kelasId } = req.params;

    // Validasi apakah guru mengajar di kelas ini
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

    const siswa = await Siswa.find({
      kelas: kelasId,
      isActive: true,
    })
      .populate("kelas", "nama tingkat jurusan")
      .select("-password")
      .sort({ name: 1 });

    res.json(siswa);
  } catch (error) {
    console.error("Error getting siswa kelas:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= NILAI MANAGEMENT =============

// Input nilai siswa
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

    // Validasi input
    if (
      !siswaId ||
      !kelasId ||
      !mataPelajaranId ||
      !jenisPenilaian ||
      nilai === undefined ||
      !semester ||
      !tahunAjaran
    ) {
      return res
        .status(400)
        .json({ message: "Semua field nilai wajib diisi." });
    }

    // Validasi nilai range 0-100
    if (nilai < 0 || nilai > 100) {
      return res.status(400).json({ message: "Nilai harus antara 0-100." });
    }

    // Validasi guru mengajar mata pelajaran di kelas
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

    // Validasi siswa ada di kelas
    const siswa = await Siswa.findOne({
      _id: siswaId,
      kelas: kelasId,
      isActive: true,
    });

    if (!siswa) {
      return res
        .status(404)
        .json({ message: "Siswa tidak ditemukan di kelas ini." });
    }

    // Cek apakah nilai sudah ada
    const existingNilai = await Nilai.findOne({
      siswa: siswaId,
      mataPelajaran: mataPelajaranId,
      jenisPenilaian,
      semester,
      tahunAjaran,
    });

    if (existingNilai) {
      // Update nilai yang sudah ada
      existingNilai.nilai = nilai;
      existingNilai.deskripsi = deskripsi;
      existingNilai.tanggalPenilaian = new Date();
      await existingNilai.save();

      res.json({
        message: "Nilai berhasil diupdate.",
        nilai: existingNilai,
      });
    } else {
      // Buat nilai baru
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

      res.status(201).json({
        message: "Nilai berhasil disimpan.",
        nilai: newNilai,
      });
    }
  } catch (error) {
    console.error("Error input nilai:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get nilai siswa per kelas dan mata pelajaran
exports.getNilaiSiswa = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId, semester, tahunAjaran } = req.query;

    if (!kelasId || !mataPelajaranId) {
      return res
        .status(400)
        .json({ message: "Kelas dan mata pelajaran wajib dipilih." });
    }

    // Validasi guru mengajar mata pelajaran di kelas
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

    let filter = {
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    };

    if (semester) filter.semester = semester;
    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;

    const nilai = await Nilai.find(filter)
      .populate("siswa", "name identifier")
      .populate("mataPelajaran", "nama kode")
      .sort({ "siswa.name": 1, jenisPenilaian: 1 });

    // Group nilai by siswa
    const nilaiPerSiswa = {};
    nilai.forEach((n) => {
      const siswaId = n.siswa._id.toString();
      if (!nilaiPerSiswa[siswaId]) {
        nilaiPerSiswa[siswaId] = {
          siswa: n.siswa,
          nilai: {},
        };
      }
      nilaiPerSiswa[siswaId].nilai[n.jenisPenilaian] = {
        nilai: n.nilai,
        deskripsi: n.deskripsi,
        tanggalPenilaian: n.tanggalPenilaian,
      };
    });

    res.json(Object.values(nilaiPerSiswa));
  } catch (error) {
    console.error("Error getting nilai siswa:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get detail nilai siswa individual
exports.getDetailNilaiSiswa = async (req, res) => {
  try {
    const { siswaId } = req.params;
    const { mataPelajaranId, semester, tahunAjaran } = req.query;

    let filter = {
      siswa: siswaId,
      guru: req.user.id, // Guru hanya bisa lihat nilai yang dia input
    };

    if (mataPelajaranId) filter.mataPelajaran = mataPelajaranId;
    if (semester) filter.semester = semester;
    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;

    const nilai = await Nilai.find(filter)
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name")
      .sort({ mataPelajaran: 1, jenisPenilaian: 1 });

    const siswa = await Siswa.findById(siswaId)
      .populate("kelas", "nama tingkat jurusan")
      .select("-password");

    if (!siswa) {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    res.json({
      siswa,
      nilai,
    });
  } catch (error) {
    console.error("Error getting detail nilai siswa:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Export nilai ke Excel
exports.exportNilai = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId, semester, tahunAjaran } = req.query;

    if (!kelasId || !mataPelajaranId) {
      return res
        .status(400)
        .json({ message: "Kelas dan mata pelajaran wajib dipilih." });
    }

    // Validasi guru mengajar mata pelajaran di kelas
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

    // Get data
    const [kelas, mataPelajaran, nilai] = await Promise.all([
      Kelas.findById(kelasId),
      MataPelajaran.findById(mataPelajaranId),
      Nilai.find({
        kelas: kelasId,
        mataPelajaran: mataPelajaranId,
        guru: req.user.id,
        ...(semester && { semester }),
        ...(tahunAjaran && { tahunAjaran }),
      }).populate("siswa", "name identifier"),
    ]);

    if (!kelas || !mataPelajaran) {
      return res
        .status(404)
        .json({ message: "Kelas atau mata pelajaran tidak ditemukan." });
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Nilai Siswa");

    // Header info
    worksheet.mergeCells("A1:F1");
    worksheet.getCell(
      "A1"
    ).value = `Nilai ${mataPelajaran.nama} - ${kelas.nama}`;
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    if (semester && tahunAjaran) {
      worksheet.mergeCells("A2:F2");
      worksheet.getCell("A2").value = `Semester ${semester} - ${tahunAjaran}`;
      worksheet.getCell("A2").alignment = { horizontal: "center" };
    }

    // Column headers
    const startRow = semester && tahunAjaran ? 4 : 3;
    worksheet.getRow(startRow).values = [
      "No",
      "NIS",
      "Nama",
      "Tugas",
      "UTS",
      "UAS",
    ];
    worksheet.getRow(startRow).font = { bold: true };

    // Data rows
    const nilaiPerSiswa = {};
    nilai.forEach((n) => {
      const siswaId = n.siswa._id.toString();
      if (!nilaiPerSiswa[siswaId]) {
        nilaiPerSiswa[siswaId] = {
          siswa: n.siswa,
          tugas: "-",
          uts: "-",
          uas: "-",
          praktek: "-",
          harian: "-",
        };
      }
      nilaiPerSiswa[siswaId][n.jenisPenilaian] = n.nilai;
    });

    let rowIndex = startRow + 1;
    let no = 1;
    Object.values(nilaiPerSiswa).forEach((data) => {
      worksheet.getRow(rowIndex).values = [
        no++,
        data.siswa.identifier,
        data.siswa.name,
        data.tugas,
        data.uts,
        data.uas,
      ];
      rowIndex++;
    });

    // Set column widths
    worksheet.columns = [
      { width: 5 }, // No
      { width: 15 }, // NIS
      { width: 25 }, // Nama
      { width: 10 }, // Tugas
      { width: 10 }, // UTS
      { width: 10 }, // UAS
    ];

    // Response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=nilai-${kelas.nama.replace(
        /\s+/g,
        "-"
      )}-${mataPelajaran.nama.replace(/\s+/g, "-")}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error exporting nilai:", error);
    res.status(500).json({ message: "Gagal export nilai ke Excel." });
  }
};

// ============= ANALISIS KINERJA SISWA =============
exports.getAnalisisKinerjaSiswa = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId, semester, tahunAjaran } = req.query;

    if (!kelasId || !mataPelajaranId) {
      return res
        .status(400)
        .json({ message: "Kelas dan mata pelajaran wajib dipilih." });
    }

    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    });

    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
      });
    }

    const nilaiSiswa = await Nilai.find({
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
      ...(semester && { semester }),
      ...(tahunAjaran && { tahunAjaran }),
    }).populate("siswa", "name");

    if (nilaiSiswa.length === 0) {
      return res.json({
        message: "Belum ada data nilai untuk analisis.",
        rataRataKelas: 0,
        distribusiNilai: {},
        nilaiTertinggi: null,
        nilaiTerendah: null,
        performaSiswa: [],
      });
    }

    let totalNilai = 0;
    const nilaiPerSiswa = {};
    const distribusiNilai = {
      "Sangat Baik (A)": 0,
      "Baik (B)": 0,
      "Cukup (C)": 0,
      "Kurang (D)": 0,
      "Sangat Kurang (E)": 0,
    };

    nilaiSiswa.forEach((n) => {
      totalNilai += n.nilai;
      const siswaId = n.siswa._id.toString();
      if (!nilaiPerSiswa[siswaId]) {
        nilaiPerSiswa[siswaId] = {
          nama: n.siswa.name,
          total: 0,
          count: 0,
        };
      }
      nilaiPerSiswa[siswaId].total += n.nilai;
      nilaiPerSiswa[siswaId].count += 1;

      if (n.nilai >= 85) distribusiNilai["Sangat Baik (A)"]++;
      else if (n.nilai >= 75) distribusiNilai["Baik (B)"]++;
      else if (n.nilai >= 65) distribusiNilai["Cukup (C)"]++;
      else if (n.nilai >= 50) distribusiNilai["Kurang (D)"]++;
      else distribusiNilai["Sangat Kurang (E)"]++;
    });

    const performaSiswa = Object.values(nilaiPerSiswa).map((s) => ({
      nama: s.nama,
      rataRata: s.total / s.count,
    }));

    performaSiswa.sort((a, b) => b.rataRata - a.rataRata);

    res.json({
      rataRataKelas: totalNilai / nilaiSiswa.length,
      distribusiNilai,
      nilaiTertinggi: performaSiswa[0],
      nilaiTerendah: performaSiswa[performaSiswa.length - 1],
      performaSiswa,
    });
  } catch (error) {
    console.error("Error getting analisis kinerja siswa:", error);
    res.status(500).json({ message: "Gagal mendapatkan analisis kinerja." });
  }
};
