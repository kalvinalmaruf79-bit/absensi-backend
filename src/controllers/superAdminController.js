const User = require("../models/User");
const MataPelajaran = require("../models/MataPelajaran");
const Kelas = require("../models/Kelas");
const Jadwal = require("../models/Jadwal");
const Settings = require("../models/Settings");
const Tugas = require("../models/Tugas");
const Materi = require("../models/Materi");
const Nilai = require("../models/Nilai");
const Absensi = require("../models/Absensi");
const SesiPresensi = require("../models/SesiPresensi");
const AcademicRules = require("../models/AcademicRules");
const ActivityLog = require("../models/ActivityLog");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const fs = require("fs");
const logActivity = require("../middleware/activityLogger");

// ============= DASHBOARD =============
exports.getDashboard = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalGuru,
      totalSiswa,
      totalMataPelajaran,
      totalKelas,
      userActivity,
      distribusiKelas,
      trenAbsensi,
      kontenDibuat,
      rasioKehadiran,
    ] = await Promise.all([
      User.countDocuments({ role: "guru", isActive: true }),
      User.countDocuments({ role: "siswa", isActive: true }),
      MataPelajaran.countDocuments({ isActive: true }),
      Kelas.countDocuments({ isActive: true }),
      ActivityLog.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              role: "$userInfo.role",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
        {
          $group: {
            _id: "$_id.date",
            activities: {
              $push: { role: "$_id.role", count: "$count" },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Kelas.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$tingkat", count: { $sum: 1 } } },
        { $project: { tingkat: "$_id", count: 1, _id: 0 } },
        { $sort: { tingkat: 1 } },
      ]),
      Absensi.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              keterangan: "$keterangan",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            rekap: { $push: { k: "$_id.keterangan", v: "$count" } },
          },
        },
        {
          $project: {
            date: "$_id",
            rekap: { $arrayToObject: "$rekap" },
            _id: 0,
          },
        },
        { $sort: { date: 1 } },
      ]),
      Promise.all([
        Tugas.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        Materi.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      ]).then(([tugas, materi]) => ({ tugas, materi })),
      Absensi.aggregate([
        { $group: { _id: "$keterangan", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } },
      ]),
    ]);

    const formatRasio = rasioKehadiran.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {});

    res.json({
      message: "Dashboard Super Admin",
      statistik: {
        utama: {
          totalGuru,
          totalSiswa,
          totalPengguna: totalGuru + totalSiswa + 1,
          totalMataPelajaran,
          totalKelas,
        },
        aktivitasPengguna: userActivity,
        distribusiKelas,
        trenAbsensi,
        kontenDibuat,
        rasioKehadiran: {
          hadir: formatRasio.hadir || 0,
          sakit: formatRasio.sakit || 0,
          izin: formatRasio.izin || 0,
          alpa: formatRasio.alpa || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      message: "Terjadi kesalahan pada server saat memuat data dashboard.",
      error: error.message,
    });
  }
};

// ============= USER MANAGEMENT (DIPERBARUI DENGAN LOGIC PASSWORD) =============
exports.createSiswa = [
  logActivity(
    "CREATE_SISWA",
    (req) =>
      `Membuat pengguna siswa baru: ${req.body.name} (${req.body.identifier}).`
  ),
  async (req, res) => {
    try {
      const { name, email, identifier, kelas, password } = req.body;

      // PERBAIKAN: Validasi password dihapus dari sini
      if (!name || !email || !identifier || !kelas) {
        return res.status(400).json({
          message: "Nama, email, identifier, dan kelas wajib diisi.",
        });
      }

      const existing = await User.findOne({ $or: [{ email }, { identifier }] });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Email atau NIS sudah digunakan." });
      }

      const kelasData = await Kelas.findById(kelas);
      if (!kelasData) {
        return res.status(400).json({ message: "Kelas tidak ditemukan." });
      }

      // PERBAIKAN: Logika password opsional
      const passwordToHash = password || identifier;
      const isPasswordDefault = !password;
      const hashedPassword = await bcrypt.hash(passwordToHash, 10);

      const newSiswa = new User({
        name,
        email,
        identifier,
        password: hashedPassword,
        kelas,
        role: "siswa",
        isPasswordDefault, // Set status password default
      });
      await newSiswa.save();

      await Kelas.findByIdAndUpdate(kelas, {
        $addToSet: { siswa: newSiswa._id },
      });

      const siswaResponse = await User.findById(newSiswa._id)
        .populate("kelas", "nama tingkat jurusan")
        .select("-password");

      res
        .status(201)
        .json({ message: "Siswa berhasil dibuat.", siswa: siswaResponse });
    } catch (error) {
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

exports.createGuru = [
  logActivity(
    "CREATE_GURU",
    (req) =>
      `Membuat pengguna guru baru: ${req.body.name} (${req.body.identifier}).`
  ),
  async (req, res) => {
    try {
      // PERBAIKAN: Ambil password dari body
      const { name, email, identifier, password } = req.body;
      if (!name || !email || !identifier) {
        return res
          .status(400)
          .json({ message: "Nama, email, dan NIP wajib diisi." });
      }

      const existing = await User.findOne({ $or: [{ email }, { identifier }] });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Email atau NIP sudah digunakan." });
      }

      // PERBAIKAN: Logika password opsional
      const passwordToHash = password || identifier;
      const isPasswordDefault = !password;
      const hashedPassword = await bcrypt.hash(passwordToHash, 10);

      const newGuru = new User({
        name,
        email,
        identifier,
        password: hashedPassword,
        role: "guru",
        isPasswordDefault,
      });
      await newGuru.save();

      const guruResponse = await User.findById(newGuru._id).select("-password");

      res
        .status(201)
        .json({ message: "Guru berhasil dibuat.", guru: guruResponse });
    } catch (error) {
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

// ... Sisa file superAdminController.js tetap sama ...
// (Saya tidak akan menempelkan ulang sisa kodenya untuk keringkasan,
// karena tidak ada perubahan di fungsi lainnya)

// ============= ACADEMIC CYCLE MANAGEMENT (BARU & DIPERBARUI) =============
/**
 * @summary Memberikan rekomendasi kenaikan kelas berdasarkan data akademik.
 */
exports.getPromotionRecommendation = async (req, res) => {
  try {
    const { kelasId, tahunAjaran } = req.query;
    if (!kelasId || !tahunAjaran) {
      return res.status(400).json({
        message: "Parameter 'kelasId' dan 'tahunAjaran' wajib diisi.",
      });
    }

    const rules = await AcademicRules.getRules();
    const {
      minAttendancePercentage,
      maxSubjectsBelowPassingGrade,
      passingGrade,
    } = rules.promotion;

    const siswaDiKelas = await User.find({
      kelas: kelasId,
      role: "siswa",
      isActive: true,
    }).select("name identifier");

    const recommendations = [];

    for (const siswa of siswaDiKelas) {
      // 1. Hitung Rekap Absensi
      const totalJadwalSetahun = await Jadwal.countDocuments({
        kelas: kelasId,
        tahunAjaran,
      });
      const totalHadir = await Absensi.countDocuments({
        siswa: siswa._id,
        keterangan: "hadir",
        $expr: {
          $eq: [
            { $year: "$createdAt" }, // Asumsi tahun ajaran cocok dengan tahun kalender
            parseInt(tahunAjaran.split("/")[0]),
          ],
        },
      });
      const attendancePercentage =
        totalJadwalSetahun > 0
          ? (totalHadir / (totalJadwalSetahun * 2)) * 100
          : 100; // Asumsi 2 semester

      // 2. Hitung Nilai di Bawah KKM
      const nilaiDiBawahKKM = await Nilai.aggregate([
        {
          $match: {
            siswa: siswa._id,
            tahunAjaran,
            nilai: { $lt: passingGrade },
          },
        },
        {
          $group: {
            _id: "$mataPelajaran",
          },
        },
        {
          $count: "total",
        },
      ]);
      const totalNilaiDiBawahKKM =
        nilaiDiBawahKKM.length > 0 ? nilaiDiBawahKKM[0].total : 0;

      // 3. Tentukan Rekomendasi
      let systemRecommendation = "Naik Kelas";
      const reasons = [];
      if (attendancePercentage < minAttendancePercentage) {
        systemRecommendation = "Tinggal Kelas";
        reasons.push(
          `Kehadiran di bawah ${minAttendancePercentage}% (hanya ${attendancePercentage.toFixed(
            2
          )}%)`
        );
      }
      if (totalNilaiDiBawahKKM > maxSubjectsBelowPassingGrade) {
        systemRecommendation = "Tinggal Kelas";
        reasons.push(
          `Memiliki ${totalNilaiDiBawahKKM} mapel di bawah KKM (batas: ${maxSubjectsBelowPassingGrade})`
        );
      }

      recommendations.push({
        siswaId: siswa._id,
        name: siswa.name,
        identifier: siswa.identifier,
        rekap: {
          attendancePercentage: attendancePercentage.toFixed(2),
          subjectsBelowPassingGrade: totalNilaiDiBawahKKM,
        },
        systemRecommendation,
        reasons,
        status: systemRecommendation, // Status awal sama dengan rekomendasi
      });
    }

    res.json({
      rules: rules.promotion,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mendapatkan rekomendasi kenaikan kelas.",
      error: error.message,
    });
  }
};

/**
 * @summary Memproses kenaikan, kelulusan, dan tinggal kelas siswa.
 */
exports.processPromotion = [
  logActivity("PROCESS_PROMOTION", (req) => {
    const { fromKelasId, tahunAjaran, siswaData } = req.body;
    const naik = siswaData.filter((s) => s.status === "Naik Kelas").length;
    const tinggal = siswaData.filter(
      (s) => s.status === "Tinggal Kelas"
    ).length;
    const lulus = siswaData.filter((s) => s.status === "Lulus").length;
    return `Memproses kenaikan kelas dari kelas ID ${fromKelasId} untuk T.A ${tahunAjaran}. Rincian: ${naik} naik, ${tinggal} tinggal, ${lulus} lulus.`;
  }),
  async (req, res) => {
    const { siswaData, fromKelasId, defaultToKelasId, tahunAjaran, semester } =
      req.body;

    if (!siswaData || !fromKelasId || !tahunAjaran || !semester) {
      return res.status(400).json({
        message:
          "Data siswa, kelas asal, tahun ajaran, dan semester wajib diisi.",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const fromKelas = await Kelas.findById(fromKelasId).session(session);
      if (!fromKelas) {
        throw new Error("Kelas asal tidak ditemukan.");
      }

      for (const data of siswaData) {
        const { siswaId, status, toKelasId } = data; // toKelasId bersifat opsional per siswa
        const siswa = await User.findById(siswaId).session(session);
        if (!siswa) {
          console.warn(`Siswa dengan ID ${siswaId} tidak ditemukan.`);
          continue;
        }

        // Catat riwayat kelas sebelum pindah
        const sudahAdaDiRiwayat = siswa.riwayatKelas.some(
          (riwayat) =>
            riwayat.kelas.equals(fromKelasId) &&
            riwayat.tahunAjaran === tahunAjaran
        );
        if (!sudahAdaDiRiwayat) {
          siswa.riwayatKelas.push({
            kelas: fromKelasId,
            tahunAjaran: tahunAjaran,
            semester: semester,
          });
        }

        if (status === "Naik Kelas") {
          const targetKelasId = toKelasId || defaultToKelasId; // Prioritaskan ID individu
          if (!targetKelasId) {
            throw new Error(
              `Kelas tujuan untuk siswa ${siswa.name} wajib diisi.`
            );
          }
          siswa.kelas = targetKelasId;
          await Kelas.findByIdAndUpdate(
            targetKelasId,
            { $addToSet: { siswa: siswaId } },
            { session }
          );
        } else if (status === "Lulus") {
          siswa.kelas = null;
          siswa.isActive = false; // Nonaktifkan siswa yang lulus
        }
        // Untuk "Tinggal Kelas", tidak ada perubahan pada field 'kelas' siswa
        await siswa.save({ session });
      }

      // Update daftar siswa di kelas lama
      const siswaYangPindahAtauLulus = siswaData
        .filter((s) => s.status === "Naik Kelas" || s.status === "Lulus")
        .map((s) => s.siswaId);

      await Kelas.findByIdAndUpdate(
        fromKelasId,
        { $pull: { siswa: { $in: siswaYangPindahAtauLulus } } },
        { session }
      );

      await session.commitTransaction();
      res.json({ message: "Proses kenaikan kelas berhasil diselesaikan." });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        message: "Terjadi kesalahan pada server saat proses kenaikan kelas.",
        error: error.message,
      });
    } finally {
      session.endSession();
    }
  },
];

// ============= PENGATURAN APLIKASI =============
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil pengaturan aplikasi." });
  }
};

exports.updateSettings = [
  logActivity(
    "UPDATE_SETTINGS",
    (req) =>
      `Memperbarui pengaturan aplikasi. T.A: ${req.body.tahunAjaranAktif}, Semester: ${req.body.semesterAktif}.`
  ),
  async (req, res) => {
    try {
      const { namaSekolah, semesterAktif, tahunAjaranAktif } = req.body;
      const settings = await Settings.findOneAndUpdate(
        { key: "global-settings" },
        { $set: { namaSekolah, semesterAktif, tahunAjaranAktif } },
        { new: true, upsert: true }
      );
      res.json({ message: "Pengaturan berhasil diperbarui.", settings });
    } catch (error) {
      res.status(500).json({ message: "Gagal memperbarui pengaturan." });
    }
  },
];

// ============= LAPORAN (BARU) =============
exports.getActivityReport = async (req, res) => {
  try {
    const { startDate, endDate, export: exportToExcel } = req.query;
    let dateFilter = {};

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const pipeline = [
      {
        $match: {
          isActive: true,
          role: "guru",
        },
      },
      {
        $lookup: {
          from: "tugas",
          localField: "_id",
          foreignField: "guru",
          pipeline: [{ $match: dateFilter }],
          as: "tugasDibuat",
        },
      },
      {
        $lookup: {
          from: "materis",
          localField: "_id",
          foreignField: "guru",
          pipeline: [{ $match: dateFilter }],
          as: "materiDibuat",
        },
      },
      {
        $lookup: {
          from: "nilais",
          localField: "_id",
          foreignField: "guru",
          pipeline: [{ $match: dateFilter }],
          as: "nilaiDimasukkan",
        },
      },
      {
        $lookup: {
          from: "sesipresensis",
          localField: "_id",
          foreignField: "dibuatOleh",
          pipeline: [{ $match: dateFilter }],
          as: "sesiPresensi",
        },
      },
      {
        $project: {
          name: 1,
          identifier: 1,
          email: 1,
          totalTugas: { $size: "$tugasDibuat" },
          totalMateri: { $size: "$materiDibuat" },
          totalInputNilai: { $size: "$nilaiDimasukkan" },
          totalSesiPresensi: { $size: "$sesiPresensi" },
        },
      },
      {
        $sort: {
          name: 1,
        },
      },
    ];

    const reportData = await User.aggregate(pipeline);

    if (exportToExcel === "true") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Laporan Aktivitas Guru");
      worksheet.columns = [
        { header: "Nama Guru", key: "name", width: 30 },
        { header: "NIP", key: "identifier", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Materi Dibuat", key: "totalMateri", width: 15 },
        { header: "Tugas Dibuat", key: "totalTugas", width: 15 },
        { header: "Input Nilai", key: "totalInputNilai", width: 15 },
        { header: "Sesi Presensi", key: "totalSesiPresensi", width: 15 },
      ];

      reportData.forEach((data) => worksheet.addRow(data));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Laporan-Aktivitas-Guru.xlsx`
      );
      await workbook.xlsx.write(res);
      return res.status(200).end();
    }

    res.json(reportData);
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghasilkan laporan aktivitas.",
      error: error.message,
    });
  }
};

// ============= USER MANAGEMENT (DIPERBARUI) =============
exports.importUsers = [
  logActivity(
    "IMPORT_USERS",
    (req) => `Mengimpor pengguna dari file Excel: ${req.file.originalname}.`
  ),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "File Excel tidak ditemukan." });
    }

    const workbook = new ExcelJS.Workbook();
    const report = {
      berhasil: 0,
      gagal: 0,
      errors: [],
      warnings: [],
    };

    try {
      await workbook.xlsx.load(req.file.buffer);

      const worksheet = workbook.getWorksheet(1);
      const bulkOps = [];
      const identifiers = new Set();
      const emails = new Set();

      const settings = await Settings.getSettings();
      const tahunAjaranAktif = settings.tahunAjaranAktif;

      const kelasCache = new Map();
      const semuaKelas = await Kelas.find({ isActive: true }).select(
        "nama tahunAjaran tingkat jurusan _id"
      );

      const normalizeString = (str) =>
        str.toLowerCase().replace(/\s+/g, " ").trim();

      semuaKelas.forEach((k) => {
        const key = `${normalizeString(k.nama)}|${k.tahunAjaran}`;
        kelasCache.set(key, {
          id: k._id,
          nama: k.nama,
          tahunAjaran: k.tahunAjaran,
          tingkat: k.tingkat,
          jurusan: k.jurusan,
        });
      });

      const headerRow = worksheet.getRow(1);
      const expectedHeaders = [
        "nama",
        "email",
        "identifier",
        "role",
        "kelas",
        "tahunajaran",
      ];
      const actualHeaders = [];
      for (let i = 1; i <= 6; i++) {
        actualHeaders.push(normalizeString(headerRow.getCell(i).text));
      }

      const hasValidHeaders = expectedHeaders.every((h) =>
        actualHeaders.includes(h)
      );
      if (!hasValidHeaders) {
        return res.status(400).json({
          message: "Format header Excel tidak valid.",
          expected: [
            "nama",
            "email",
            "identifier",
            "role",
            "kelas",
            "tahunAjaran",
          ],
          received: actualHeaders,
        });
      }

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);

        const name = row.getCell(1).text.trim();
        const email = row.getCell(2).text.trim();
        const identifier = row.getCell(3).text.trim();
        const role = row.getCell(4).text.trim().toLowerCase();
        const kelasNama = row.getCell(5).text.trim();
        let tahunAjaran = row.getCell(6).text.trim();
        const isTahunAjaranKosong = !tahunAjaran;

        if (!name && !email && !identifier && !role) {
          continue;
        }

        if (!name || !email || !identifier || !role) {
          report.gagal++;
          report.errors.push({
            row: rowNumber,
            message:
              "Data tidak lengkap (nama, email, identifier, role wajib diisi).",
            data: { name, email, identifier, role },
          });
          continue;
        }

        if (!["siswa", "guru"].includes(role)) {
          report.gagal++;
          report.errors.push({
            row: rowNumber,
            message: "Role tidak valid, harus 'siswa' atau 'guru'.",
            data: { role },
          });
          continue;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          report.gagal++;
          report.errors.push({
            row: rowNumber,
            message: "Format email tidak valid.",
            data: { email },
          });
          continue;
        }

        if (identifiers.has(identifier)) {
          report.gagal++;
          report.errors.push({
            row: rowNumber,
            message: "Identifier duplikat di dalam file.",
            data: { identifier },
          });
          continue;
        }
        if (emails.has(email)) {
          report.gagal++;
          report.errors.push({
            row: rowNumber,
            message: "Email duplikat di dalam file.",
            data: { email },
          });
          continue;
        }

        identifiers.add(identifier);
        emails.add(email);

        let kelasId = null;

        if (role === "siswa") {
          if (!kelasNama) {
            report.gagal++;
            report.errors.push({
              row: rowNumber,
              message: "Nama kelas wajib diisi untuk siswa.",
              data: { name, identifier },
            });
            continue;
          }

          if (!tahunAjaran) {
            tahunAjaran = tahunAjaranAktif;
            report.warnings.push({
              row: rowNumber,
              message: `Tahun ajaran tidak diisi, menggunakan tahun ajaran aktif: ${tahunAjaranAktif}`,
              data: { name, identifier },
            });
          }

          const tahunAjaranRegex = /^\d{4}\/\d{4}$/;
          if (!tahunAjaranRegex.test(tahunAjaran)) {
            report.gagal++;
            report.errors.push({
              row: rowNumber,
              message:
                "Format tahun ajaran tidak valid. Gunakan format YYYY/YYYY (contoh: 2025/2026)",
              data: { tahunAjaran },
            });
            continue;
          }

          const kelasKey = `${normalizeString(kelasNama)}|${tahunAjaran}`;
          const kelasData = kelasCache.get(kelasKey);

          if (!kelasData) {
            const alternativeKelas = semuaKelas.filter(
              (k) => normalizeString(k.nama) === normalizeString(kelasNama)
            );

            let errorMessage = `Kelas '${kelasNama}' untuk tahun ajaran '${tahunAjaran}' tidak ditemukan`;
            if (isTahunAjaranKosong) {
              errorMessage += ` (menggunakan tahun ajaran aktif)`;
            }
            errorMessage += `.`;

            if (alternativeKelas.length > 0) {
              const availableYears = alternativeKelas
                .map((k) => k.tahunAjaran)
                .join(", ");
              errorMessage += ` Kelas '${kelasNama}' tersedia untuk tahun ajaran: ${availableYears}`;
            }

            report.gagal++;
            report.errors.push({
              row: rowNumber,
              message: errorMessage,
              data: { kelasNama, tahunAjaran },
            });
            continue;
          }

          kelasId = kelasData.id;
        }

        const hashedPassword = await bcrypt.hash(identifier, 10);

        bulkOps.push({
          updateOne: {
            filter: { $or: [{ email }, { identifier }] },
            update: {
              $setOnInsert: {
                name,
                email,
                identifier,
                password: hashedPassword,
                role,
                kelas: role === "siswa" ? kelasId : undefined,
                isPasswordDefault: true,
              },
            },
            upsert: true,
          },
        });
      }

      if (bulkOps.length > 0) {
        const result = await User.bulkWrite(bulkOps);
        report.berhasil = result.upsertedCount;

        if (result.upsertedIds && Object.keys(result.upsertedIds).length > 0) {
          const siswaIds = Object.values(result.upsertedIds);
          const siswaBaru = await User.find({
            _id: { $in: siswaIds },
            role: "siswa",
          }).select("_id kelas");

          const siswaByKelas = {};
          siswaBaru.forEach((siswa) => {
            if (siswa.kelas) {
              if (!siswaByKelas[siswa.kelas]) {
                siswaByKelas[siswa.kelas] = [];
              }
              siswaByKelas[siswa.kelas].push(siswa._id);
            }
          });

          for (const [kelasId, siswaIds] of Object.entries(siswaByKelas)) {
            await Kelas.findByIdAndUpdate(kelasId, {
              $addToSet: { siswa: { $each: siswaIds } },
            });
          }
        }
      }

      res.status(200).json({
        message: "Proses impor selesai.",
        report,
      });
    } catch (error) {
      console.error("Error importing users:", error);
      res.status(500).json({
        message: "Terjadi kesalahan saat memproses file Excel.",
        error: error.message,
      });
    }
  },
];

exports.getAllUsers = async (req, res) => {
  try {
    const {
      role,
      isActive,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    let query = {};
    if (role && role !== "all") {
      query.role = role;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { identifier: searchRegex },
      ];
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 },
      populate: [
        { path: "mataPelajaran", select: "nama kode" },
        { path: "kelas", select: "nama tingkat jurusan" },
      ],
      select: "-password",
    };

    const result = await User.paginate(query, options);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("mataPelajaran", "nama kode")
      .populate("kelas", "nama tingkat jurusan")
      .select("-password");

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.updateUser = [
  logActivity(
    "UPDATE_USER",
    (req) => `Memperbarui data pengguna ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, isActive, kelas } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User tidak ditemukan." });
      }

      if (user.role === "siswa" && kelas && user.kelas?.toString() !== kelas) {
        const settings = await Settings.getSettings();

        const sudahAdaDiRiwayat = user.riwayatKelas.some(
          (riwayat) =>
            riwayat.kelas.equals(user.kelas) &&
            riwayat.tahunAjaran === settings.tahunAjaranAktif &&
            riwayat.semester === settings.semesterAktif
        );

        if (user.kelas && !sudahAdaDiRiwayat) {
          user.riwayatKelas.push({
            kelas: user.kelas,
            tahunAjaran: settings.tahunAjaranAktif,
            semester: settings.semesterAktif,
          });
        }

        if (user.kelas) {
          await Kelas.findByIdAndUpdate(user.kelas, {
            $pull: { siswa: user._id },
          });
        }
        user.kelas = kelas;
        await Kelas.findByIdAndUpdate(kelas, {
          $addToSet: { siswa: user._id },
        });
      }

      if (name) user.name = name;
      if (email) user.email = email;
      if (isActive !== undefined) user.isActive = isActive;

      await user.save();

      const updatedUser = await User.findById(id)
        .populate("mataPelajaran", "nama kode")
        .populate("kelas", "nama tingkat jurusan")
        .select("-password");

      res.json({ message: "User berhasil diupdate.", user: updatedUser });
    } catch (error) {
      res.status(500).json({
        message: "Terjadi kesalahan pada server.",
        error: error.message,
      });
    }
  },
];

exports.deleteUser = [
  logActivity(
    "DELETE_USER",
    (req) => `Menonaktifkan pengguna ID: ${req.params.id}.`
  ),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const userId = req.params.id;
      const user = await User.findById(userId).session(session);

      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "User tidak ditemukan." });
      }

      user.isActive = false;

      if (user.role === "siswa" && user.kelas) {
        await Kelas.findByIdAndUpdate(
          user.kelas,
          { $pull: { siswa: userId } },
          { session }
        );
      }

      await user.save({ session });

      await session.commitTransaction();
      res.json({
        message: "User berhasil dinonaktifkan dan relasi data dibersihkan.",
      });
    } catch (error) {
      await session.abortTransaction();
      res
        .status(500)
        .json({ message: "Gagal menonaktifkan user.", error: error.message });
    } finally {
      session.endSession();
    }
  },
];

exports.resetPassword = [
  logActivity(
    "RESET_PASSWORD",
    (req) => `Mereset password untuk pengguna ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User tidak ditemukan." });
      }

      const hashedPassword = await bcrypt.hash(user.identifier, 10);
      user.password = hashedPassword;
      user.isPasswordDefault = true;
      await user.save();

      res.json({ message: "Password berhasil direset ke identifier." });
    } catch (error) {
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

// ============= MATA PELAJARAN MANAGEMENT =============
exports.getMataPelajaranStats = async (req, res) => {
  try {
    const mapelId = req.params.id;
    const mataPelajaran = await MataPelajaran.findById(mapelId)
      .populate("guru", "name identifier")
      .populate("createdBy", "name");

    if (!mataPelajaran) {
      return res.status(404).json({
        success: false,
        message: "Mata pelajaran tidak ditemukan.",
      });
    }

    const [jumlahJadwal, jumlahNilai, jumlahTugas, jumlahMateri] =
      await Promise.all([
        Jadwal.countDocuments({ mataPelajaran: mapelId }),
        Nilai.countDocuments({ mataPelajaran: mapelId }),
        Tugas.countDocuments({ mataPelajaran: mapelId }),
        Materi.countDocuments({ mataPelajaran: mapelId }),
      ]);

    res.json({
      success: true,
      mataPelajaran: {
        _id: mataPelajaran._id,
        nama: mataPelajaran.nama,
        kode: mataPelajaran.kode,
        deskripsi: mataPelajaran.deskripsi,
        isActive: mataPelajaran.isActive,
      },
      stats: {
        jumlahGuru: mataPelajaran.guru.length,
        jumlahJadwal,
        jumlahNilai,
        jumlahTugas,
        jumlahMateri,
      },
      guru: mataPelajaran.guru.map((g) => ({
        _id: g._id,
        name: g.name,
        identifier: g.identifier,
      })),
      canSafeDelete: mataPelajaran.guru.length === 0 && jumlahNilai === 0,
      recommendation:
        mataPelajaran.guru.length === 0 && jumlahNilai === 0
          ? "Aman untuk dihapus permanen"
          : "Disarankan lepas penugasan guru terlebih dahulu atau gunakan soft delete",
    });
  } catch (error) {
    console.error("Error getting mata pelajaran stats:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.createMataPelajaran = [
  logActivity(
    "CREATE_MATAPELAJARAN",
    (req) => `Membuat mata pelajaran baru: ${req.body.nama} (${req.body.kode}).`
  ),
  async (req, res) => {
    try {
      const { nama, kode, deskripsi } = req.body;
      if (!nama || !kode) {
        return res
          .status(400)
          .json({ message: "Nama dan kode mata pelajaran wajib diisi." });
      }
      const existing = await MataPelajaran.findOne({
        $or: [{ nama }, { kode }],
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Nama atau kode mata pelajaran sudah ada." });
      }
      const mataPelajaran = new MataPelajaran({
        nama,
        kode: kode.toUpperCase(),
        deskripsi,
        createdBy: req.user.id,
      });
      await mataPelajaran.save();
      res
        .status(201)
        .json({ message: "Mata pelajaran berhasil dibuat.", mataPelajaran });
    } catch (error) {
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

exports.getAllMataPelajaran = async (req, res) => {
  try {
    const {
      isActive,
      search,
      page = 1,
      limit = 10,
      sortBy = "nama",
      sortOrder = "asc",
    } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ nama: searchRegex }, { kode: searchRegex }];
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 },
      populate: [
        { path: "guru", select: "name identifier" },
        { path: "createdBy", select: "name" },
      ],
    };

    const result = await MataPelajaran.paginate(query, options);

    const finalData = result.docs.map((mapel) => {
      const mapelObj = mapel.toObject();
      mapelObj.jumlahGuru = mapelObj.guru.length;
      return mapelObj;
    });

    res.json({ ...result, docs: finalData });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getMataPelajaranById = async (req, res) => {
  try {
    const mataPelajaran = await MataPelajaran.findById(req.params.id)
      .populate("guru", "name identifier")
      .populate("createdBy", "name");
    if (!mataPelajaran) {
      return res
        .status(404)
        .json({ message: "Mata pelajaran tidak ditemukan." });
    }
    res.json(mataPelajaran);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.updateMataPelajaran = [
  logActivity(
    "UPDATE_MATAPELAJARAN",
    (req) => `Memperbarui mata pelajaran ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const mataPelajaran = await MataPelajaran.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );
      if (!mataPelajaran) {
        return res
          .status(404)
          .json({ message: "Mata pelajaran tidak ditemukan." });
      }
      res.json({
        message: "Mata pelajaran berhasil diupdate.",
        mataPelajaran,
      });
    } catch (error) {
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

exports.deleteMataPelajaran = [
  logActivity(
    "DELETE_MATAPELAJARAN",
    (req) => `Menonaktifkan (soft delete) mata pelajaran ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const mataPelajaran = await MataPelajaran.findByIdAndUpdate(
        req.params.id,
        {
          isActive: false,
        }
      );
      if (!mataPelajaran) {
        return res
          .status(404)
          .json({ message: "Mata pelajaran tidak ditemukan." });
      }
      res.json({ message: "Mata pelajaran berhasil dihapus." });
    } catch (error) {
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

exports.forceDeleteMataPelajaran = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const mapelId = req.params.id;
    const mataPelajaran = await MataPelajaran.findById(mapelId).session(
      session
    );

    if (!mataPelajaran) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Mata pelajaran tidak ditemukan.",
      });
    }

    const [jumlahGuru, jumlahJadwal, jumlahNilai, jumlahTugas, jumlahMateri] =
      await Promise.all([
        User.countDocuments({ mataPelajaran: mapelId }).session(session),
        Jadwal.countDocuments({ mataPelajaran: mapelId }).session(session),
        Nilai.countDocuments({ mataPelajaran: mapelId }).session(session),
        Tugas.countDocuments({ mataPelajaran: mapelId }).session(session),
        Materi.countDocuments({ mataPelajaran: mapelId }).session(session),
      ]);

    const dataRelasi = {
      guru: jumlahGuru,
      jadwal: jumlahJadwal,
      nilai: jumlahNilai,
      tugas: jumlahTugas,
      materi: jumlahMateri,
    };

    const totalRelasi = Object.values(dataRelasi).reduce(
      (sum, val) => sum + val,
      0
    );

    if (totalRelasi > 0 && req.query.confirm !== "yes") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Mata pelajaran ini memiliki ${totalRelasi} data terkait yang akan terhapus permanen!`,
        warning: "PERHATIAN: Penghapusan permanen tidak dapat dibatalkan!",
        dataRelasi,
        totalRelasi,
        actions: {
          confirmDelete: {
            method: "DELETE",
            url: `/super-admin/mata-pelajaran/${mapelId}/force?confirm=yes`,
            warning: "Akan menghapus SEMUA data terkait secara permanen",
          },
          alternative:
            "Lepas penugasan guru terlebih dahulu, lalu hapus mata pelajaran kosong",
        },
      });
    }

    if (totalRelasi === 0 || req.query.confirm === "yes") {
      await User.updateMany(
        { mataPelajaran: mapelId },
        { $pull: { mataPelajaran: mapelId } },
        { session }
      );

      await Promise.all([
        Jadwal.deleteMany({ mataPelajaran: mapelId }, { session }),
        Nilai.deleteMany({ mataPelajaran: mapelId }, { session }),
        Tugas.deleteMany({ mataPelajaran: mapelId }, { session }),
        Materi.deleteMany({ mataPelajaran: mapelId }, { session }),
      ]);

      await MataPelajaran.findByIdAndDelete(mapelId).session(session);

      await session.commitTransaction();

      res.json({
        success: true,
        message:
          "Mata pelajaran dan semua data terkait berhasil dihapus permanen.",
        deletedData: dataRelasi,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Error force deleting mata pelajaran:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.restoreMataPelajaran = async (req, res) => {
  try {
    const mataPelajaran = await MataPelajaran.findById(req.params.id);

    if (!mataPelajaran) {
      return res.status(404).json({
        success: false,
        message: "Mata pelajaran tidak ditemukan.",
      });
    }

    if (mataPelajaran.isActive) {
      return res.status(400).json({
        success: false,
        message: "Mata pelajaran sudah aktif.",
      });
    }

    mataPelajaran.isActive = true;
    await mataPelajaran.save();

    const jadwalUpdated = await Jadwal.updateMany(
      { mataPelajaran: req.params.id },
      { isActive: true }
    );

    res.json({
      success: true,
      message: "Mata pelajaran berhasil diaktifkan kembali.",
      data: mataPelajaran,
      jadwalRestored: jadwalUpdated.modifiedCount,
    });
  } catch (error) {
    console.error("Error restoring mata pelajaran:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.assignGuruMataPelajaran = [
  logActivity(
    "ASSIGN_GURU_MAPEL",
    (req) =>
      `Menugaskan guru ID ${req.body.guruId} ke mata pelajaran ID ${req.body.mataPelajaranId}.`
  ),
  async (req, res) => {
    try {
      const { mataPelajaranId, guruId } = req.body;

      const mataPelajaran = await MataPelajaran.findById(mataPelajaranId);
      if (!mataPelajaran) {
        return res
          .status(404)
          .json({ message: "Mata pelajaran tidak ditemukan." });
      }

      const guru = await User.findOne({ _id: guruId, role: "guru" });
      if (!guru) {
        return res.status(404).json({ message: "Guru tidak ditemukan." });
      }

      await Promise.all([
        User.findByIdAndUpdate(guruId, {
          $addToSet: { mataPelajaran: mataPelajaranId },
        }),
        MataPelajaran.findByIdAndUpdate(mataPelajaranId, {
          $addToSet: { guru: guruId },
        }),
      ]);

      res.json({ message: "Guru berhasil ditugaskan ke mata pelajaran." });
    } catch (error) {
      console.error("Error assigning guru:", error);
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

exports.unassignGuruMataPelajaran = [
  logActivity(
    "UNASSIGN_GURU_MAPEL",
    (req) =>
      `Melepas penugasan guru ID ${req.body.guruId} dari mata pelajaran ID ${req.body.mataPelajaranId}.`
  ),
  async (req, res) => {
    try {
      const { mataPelajaranId, guruId } = req.body;

      const mataPelajaran = await MataPelajaran.findById(mataPelajaranId);
      if (!mataPelajaran) {
        return res
          .status(404)
          .json({ message: "Mata pelajaran tidak ditemukan." });
      }
      const guru = await User.findOne({ _id: guruId, role: "guru" });
      if (!guru) {
        return res.status(404).json({ message: "Guru tidak ditemukan." });
      }

      await Promise.all([
        User.findByIdAndUpdate(guruId, {
          $pull: { mataPelajaran: mataPelajaranId },
        }),
        MataPelajaran.findByIdAndUpdate(mataPelajaranId, {
          $pull: { guru: guruId },
        }),
      ]);

      res.json({
        message: "Penugasan guru dari mata pelajaran berhasil dihapus.",
      });
    } catch (error) {
      console.error("Error unassigning guru:", error);
      res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
  },
];

// ============= KELAS MANAGEMENT (COMPLETE WITH MULTI-LEVEL DELETE) =============
exports.createKelas = [
  logActivity(
    "CREATE_KELAS",
    (req) => `Membuat kelas baru: ${req.body.nama} T.A ${req.body.tahunAjaran}.`
  ),
  async (req, res) => {
    try {
      const { nama, tingkat, jurusan, tahunAjaran, waliKelas } = req.body;
      if (!nama || !tingkat || !tahunAjaran) {
        return res.status(400).json({
          success: false,
          message: "Nama, tingkat, dan tahun ajaran wajib diisi.",
        });
      }

      const existingKelas = await Kelas.findOne({ nama, tahunAjaran });
      if (existingKelas) {
        return res.status(400).json({
          success: false,
          message: "Kelas dengan nama dan tahun ajaran yang sama sudah ada.",
        });
      }

      const newKelas = new Kelas({
        nama,
        tingkat,
        jurusan,
        tahunAjaran,
        waliKelas,
        createdBy: req.user.id,
      });

      await newKelas.save();
      const populatedKelas = await Kelas.findById(newKelas._id).populate(
        "waliKelas",
        "name identifier"
      );

      res.status(201).json({
        success: true,
        message: "Kelas berhasil dibuat.",
        data: populatedKelas,
      });
    } catch (error) {
      console.error("Error creating kelas:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server.",
        error: error.message,
      });
    }
  },
];

exports.getKelasById = async (req, res) => {
  try {
    const kelas = await Kelas.findById(req.params.id)
      .populate("waliKelas", "name identifier")
      .populate("siswa", "name identifier")
      .populate("createdBy", "name");

    if (!kelas) {
      return res.status(404).json({
        success: false,
        message: "Kelas tidak ditemukan.",
      });
    }
    res.json({
      success: true,
      data: kelas,
    });
  } catch (error) {
    console.error("Error getting kelas by ID:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.updateKelas = [
  logActivity(
    "UPDATE_KELAS",
    (req) => `Memperbarui data kelas ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const { nama, tingkat, jurusan, tahunAjaran, waliKelas, isActive } =
        req.body;
      const updatedKelas = await Kelas.findByIdAndUpdate(
        req.params.id,
        { nama, tingkat, jurusan, tahunAjaran, waliKelas, isActive },
        { new: true, runValidators: true }
      ).populate("waliKelas", "name identifier");

      if (!updatedKelas) {
        return res.status(404).json({
          success: false,
          message: "Kelas tidak ditemukan.",
        });
      }
      res.json({
        success: true,
        message: "Kelas berhasil diperbarui.",
        data: updatedKelas,
      });
    } catch (error) {
      console.error("Error updating kelas:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server.",
        error: error.message,
      });
    }
  },
];

exports.getAllKelas = async (req, res) => {
  try {
    const {
      isActive,
      search,
      page = 1,
      limit = 10,
      sortBy = "tingkat",
      sortOrder = "asc",
    } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { nama: searchRegex },
        { tingkat: searchRegex },
        { jurusan: searchRegex },
        { tahunAjaran: searchRegex },
      ];
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 },
      populate: [
        { path: "waliKelas", select: "name identifier" },
        { path: "createdBy", select: "name" },
      ],
      customLabels: {
        docs: "data",
        totalDocs: "totalData",
      },
    };

    const result = await Kelas.paginate(query, options);

    const populatedResult = await Kelas.populate(result.data, {
      path: "siswa",
      select: "_id",
    });

    const finalData = populatedResult.map((kelas) => {
      const kelasObj = kelas.toObject();
      kelasObj.jumlahSiswa = kelasObj.siswa.length;
      delete kelasObj.siswa;
      return kelasObj;
    });

    res.json({
      success: true,
      ...result,
      data: finalData,
    });
  } catch (error) {
    console.error("Error getting kelas:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.deleteKelas = [
  logActivity(
    "DELETE_KELAS",
    (req) => `Menonaktifkan (soft delete) kelas ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const kelas = await Kelas.findById(req.params.id);

      if (!kelas) {
        return res.status(404).json({
          success: false,
          message: "Kelas tidak ditemukan.",
        });
      }

      if (!kelas.isActive) {
        return res.status(400).json({
          success: false,
          message: "Kelas sudah nonaktif.",
        });
      }

      const jumlahSiswaAktif = await User.countDocuments({
        kelas: req.params.id,
        role: "siswa",
        isActive: true,
      });

      if (jumlahSiswaAktif > 0) {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat menonaktifkan kelas. Masih ada ${jumlahSiswaAktif} siswa aktif. Pindahkan siswa terlebih dahulu atau gunakan force delete.`,
          canForceDelete: true,
          siswaCount: jumlahSiswaAktif,
        });
      }

      kelas.isActive = false;
      await kelas.save();

      await Jadwal.updateMany({ kelas: req.params.id }, { isActive: false });

      res.json({
        success: true,
        message:
          "Kelas berhasil dinonaktifkan. Data masih dapat dipulihkan jika diperlukan.",
      });
    } catch (error) {
      console.error("Error soft deleting kelas:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server.",
        error: error.message,
      });
    }
  },
];

exports.forceDeleteKelas = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const kelasId = req.params.id;
    const kelas = await Kelas.findById(kelasId).session(session);

    if (!kelas) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Kelas tidak ditemukan.",
      });
    }

    const [
      jumlahSiswa,
      jumlahJadwal,
      jumlahNilai,
      jumlahAbsensi,
      jumlahTugas,
      jumlahMateri,
    ] = await Promise.all([
      User.countDocuments({ kelas: kelasId }).session(session),
      Jadwal.countDocuments({ kelas: kelasId }).session(session),
      Nilai.countDocuments({ kelas: kelasId }).session(session),
      Absensi.countDocuments({ kelas: kelasId }).session(session),
      Tugas.countDocuments({ kelas: kelasId }).session(session),
      Materi.countDocuments({ kelas: kelasId }).session(session),
    ]);

    const dataRelasi = {
      siswa: jumlahSiswa,
      jadwal: jumlahJadwal,
      nilai: jumlahNilai,
      absensi: jumlahAbsensi,
      tugas: jumlahTugas,
      materi: jumlahMateri,
    };

    const totalRelasi = Object.values(dataRelasi).reduce(
      (sum, val) => sum + val,
      0
    );

    if (totalRelasi > 0 && req.query.confirm !== "yes") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Kelas ini memiliki ${totalRelasi} data terkait yang akan terhapus permanen!`,
        warning: "PERHATIAN: Penghapusan permanen tidak dapat dibatalkan!",
        dataRelasi,
        totalRelasi,
        actions: {
          confirmDelete: {
            method: "DELETE",
            url: `/super-admin/kelas/${kelasId}/force?confirm=yes`,
            warning: "Akan menghapus SEMUA data terkait secara permanen",
          },
          alternative:
            "Pindahkan siswa ke kelas lain terlebih dahulu, lalu hapus kelas kosong",
        },
      });
    }

    if (totalRelasi === 0 || req.query.confirm === "yes") {
      await Promise.all([
        User.updateMany(
          { kelas: kelasId },
          { $set: { kelas: null } },
          { session }
        ),
        Jadwal.deleteMany({ kelas: kelasId }, { session }),
        Nilai.deleteMany({ kelas: kelasId }, { session }),
        Absensi.deleteMany({ kelas: kelasId }, { session }),
        Tugas.deleteMany({ kelas: kelasId }, { session }),
        Materi.deleteMany({ kelas: kelasId }, { session }),
      ]);

      await Kelas.findByIdAndDelete(kelasId).session(session);

      await session.commitTransaction();

      res.json({
        success: true,
        message: "Kelas dan semua data terkait berhasil dihapus permanen.",
        deletedData: dataRelasi,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Error force deleting kelas:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.restoreKelas = async (req, res) => {
  try {
    const kelas = await Kelas.findById(req.params.id);

    if (!kelas) {
      return res.status(404).json({
        success: false,
        message: "Kelas tidak ditemukan.",
      });
    }

    if (kelas.isActive) {
      return res.status(400).json({
        success: false,
        message: "Kelas sudah aktif.",
      });
    }

    if (kelas.waliKelas) {
      const waliKelas = await User.findById(kelas.waliKelas);
      if (!waliKelas || !waliKelas.isActive) {
        return res.status(400).json({
          success: false,
          message:
            "Tidak dapat mengaktifkan kelas. Wali kelas tidak aktif atau tidak ditemukan. Silakan update wali kelas terlebih dahulu.",
        });
      }
    }

    kelas.isActive = true;
    await kelas.save();

    const jadwalUpdated = await Jadwal.updateMany(
      { kelas: req.params.id },
      { isActive: true }
    );

    res.json({
      success: true,
      message: "Kelas berhasil diaktifkan kembali.",
      data: kelas,
      jadwalRestored: jadwalUpdated.modifiedCount,
    });
  } catch (error) {
    console.error("Error restoring kelas:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.getKelasStats = async (req, res) => {
  try {
    const kelasId = req.params.id;
    const kelas = await Kelas.findById(kelasId)
      .populate("waliKelas", "name identifier")
      .populate("siswa", "name identifier");

    if (!kelas) {
      return res.status(404).json({
        success: false,
        message: "Kelas tidak ditemukan.",
      });
    }

    const [
      jumlahJadwal,
      jumlahNilai,
      jumlahAbsensi,
      jumlahTugas,
      jumlahMateri,
      siswaDenganNilai,
    ] = await Promise.all([
      Jadwal.countDocuments({ kelas: kelasId }),
      Nilai.countDocuments({ kelas: kelasId }),
      Absensi.countDocuments({ siswa: { $in: kelas.siswa.map((s) => s._id) } }),
      Tugas.countDocuments({ kelas: kelasId }),
      Materi.countDocuments({ kelas: kelasId }),
      Nilai.distinct("siswa", { kelas: kelasId }),
    ]);

    res.json({
      success: true,
      kelas: {
        _id: kelas._id,
        nama: kelas.nama,
        tingkat: kelas.tingkat,
        jurusan: kelas.jurusan,
        tahunAjaran: kelas.tahunAjaran,
        isActive: kelas.isActive,
        waliKelas: kelas.waliKelas,
      },
      stats: {
        jumlahSiswa: kelas.siswa.length,
        jumlahJadwal,
        jumlahNilai,
        jumlahAbsensi,
        jumlahTugas,
        jumlahMateri,
        siswaDenganNilai: siswaDenganNilai.length,
      },
      siswa: kelas.siswa.map((s) => ({
        _id: s._id,
        name: s.name,
        identifier: s.identifier,
      })),
      canSafeDelete: kelas.siswa.length === 0 && jumlahNilai === 0,
      recommendation:
        kelas.siswa.length === 0
          ? "Aman untuk dihapus permanen"
          : "Disarankan pindahkan siswa terlebih dahulu atau gunakan soft delete",
    });
  } catch (error) {
    console.error("Error getting kelas stats:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

// ============= JADWAL MANAGEMENT (ENHANCED) =============
exports.getJadwalStats = async (req, res) => {
  try {
    const jadwalId = req.params.id;
    const jadwal = await Jadwal.findById(jadwalId)
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier");

    if (!jadwal) {
      return res.status(404).json({
        success: false,
        message: "Jadwal tidak ditemukan.",
      });
    }

    const [
      jumlahAbsensi,
      jumlahSesiPresensi,
      jumlahNilai,
      jumlahTugas,
      jumlahMateri,
    ] = await Promise.all([
      Absensi.countDocuments({
        jadwal: jadwalId,
      }),
      SesiPresensi.countDocuments({
        jadwal: jadwalId,
      }),
      Nilai.countDocuments({
        jadwal: jadwalId,
      }),
      Tugas.countDocuments({
        jadwal: jadwalId,
      }),
      Materi.countDocuments({
        jadwal: jadwalId,
      }),
    ]);

    const dataRelasi = {
      absensi: jumlahAbsensi,
      sesiPresensi: jumlahSesiPresensi,
      nilai: jumlahNilai,
      tugas: jumlahTugas,
      materi: jumlahMateri,
    };

    const totalRelasi = Object.values(dataRelasi).reduce(
      (sum, val) => sum + val,
      0
    );

    res.json({
      success: true,
      jadwal: {
        _id: jadwal._id,
        kelas: jadwal.kelas,
        mataPelajaran: jadwal.mataPelajaran,
        guru: jadwal.guru,
        hari: jadwal.hari,
        jamMulai: jadwal.jamMulai,
        jamSelesai: jadwal.jamSelesai,
        semester: jadwal.semester,
        tahunAjaran: jadwal.tahunAjaran,
        isActive: jadwal.isActive,
      },
      stats: dataRelasi,
      totalRelasi,
      canSafeDelete: totalRelasi === 0,
      recommendation:
        totalRelasi === 0
          ? "Aman untuk dihapus permanen"
          : `Jadwal memiliki ${totalRelasi} data terkait. Disarankan menggunakan soft delete atau hapus data terkait terlebih dahulu`,
    });
  } catch (error) {
    console.error("Error getting jadwal stats:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.createJadwal = [
  logActivity(
    "CREATE_JADWAL",
    (req) =>
      `Membuat jadwal baru pada hari ${req.body.hari} jam ${req.body.jamMulai}-${req.body.jamSelesai}.`
  ),
  async (req, res) => {
    try {
      const {
        kelas,
        mataPelajaran,
        guru,
        hari,
        jamMulai,
        jamSelesai,
        semester,
        tahunAjaran,
      } = req.body;

      if (
        !kelas ||
        !mataPelajaran ||
        !guru ||
        !hari ||
        !jamMulai ||
        !jamSelesai ||
        !semester ||
        !tahunAjaran
      ) {
        return res.status(400).json({
          success: false,
          message: "Semua field jadwal wajib diisi.",
        });
      }

      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(jamMulai) || !timeRegex.test(jamSelesai)) {
        return res.status(400).json({
          success: false,
          message:
            "Format waktu tidak valid. Gunakan format HH:MM (contoh: 07:00, 13:45)",
        });
      }

      const parseTime = (time) => {
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
      };

      const startMinutes = parseTime(jamMulai);
      const endMinutes = parseTime(jamSelesai);

      if (endMinutes <= startMinutes) {
        return res.status(400).json({
          success: false,
          message: "Jam selesai harus lebih besar dari jam mulai.",
        });
      }

      const guruData = await User.findOne({
        _id: guru,
        role: "guru",
        isActive: true,
      });
      if (!guruData) {
        return res.status(404).json({
          success: false,
          message: "Guru tidak ditemukan atau tidak aktif.",
        });
      }

      if (!guruData.mataPelajaran.includes(mataPelajaran)) {
        return res.status(400).json({
          success: false,
          message: "Guru tidak mengampu mata pelajaran ini.",
        });
      }

      const kelasData = await Kelas.findOne({ _id: kelas, isActive: true });
      if (!kelasData) {
        return res.status(404).json({
          success: false,
          message: "Kelas tidak ditemukan atau tidak aktif.",
        });
      }

      const mapelData = await MataPelajaran.findOne({
        _id: mataPelajaran,
        isActive: true,
      });
      if (!mapelData) {
        return res.status(404).json({
          success: false,
          message: "Mata pelajaran tidak ditemukan atau tidak aktif.",
        });
      }

      const checkConflict = async (targetId, targetField) => {
        const existingJadwal = await Jadwal.find({
          [targetField]: targetId,
          hari,
          tahunAjaran,
          semester,
          isActive: true,
        });

        for (const existing of existingJadwal) {
          const existingStart = parseTime(existing.jamMulai);
          const existingEnd = parseTime(existing.jamSelesai);

          const hasOverlap =
            startMinutes < existingEnd &&
            endMinutes > existingStart &&
            !(startMinutes === existingEnd || endMinutes === existingStart);

          if (hasOverlap) {
            return existing;
          }
        }
        return null;
      };

      const kelasConflict = await checkConflict(kelas, "kelas");
      if (kelasConflict) {
        return res.status(400).json({
          success: false,
          message: `Jadwal bentrok dengan jadwal kelas yang sudah ada pada ${hari} jam ${kelasConflict.jamMulai}-${kelasConflict.jamSelesai}`,
          conflictWith: "kelas",
          existingJadwal: {
            id: kelasConflict._id,
            jamMulai: kelasConflict.jamMulai,
            jamSelesai: kelasConflict.jamSelesai,
          },
        });
      }

      const guruConflict = await checkConflict(guru, "guru");
      if (guruConflict) {
        return res.status(400).json({
          success: false,
          message: `Jadwal bentrok dengan jadwal guru yang sudah ada pada ${hari} jam ${guruConflict.jamMulai}-${guruConflict.jamSelesai}`,
          conflictWith: "guru",
          existingJadwal: {
            id: guruConflict._id,
            jamMulai: guruConflict.jamMulai,
            jamSelesai: guruConflict.jamSelesai,
          },
        });
      }

      const jadwal = new Jadwal({
        kelas,
        mataPelajaran,
        guru,
        hari,
        jamMulai,
        jamSelesai,
        semester,
        tahunAjaran,
        createdBy: req.user.id,
      });

      await jadwal.save();

      const jadwalResponse = await Jadwal.findById(jadwal._id)
        .populate("kelas", "nama tingkat jurusan")
        .populate("mataPelajaran", "nama kode")
        .populate("guru", "name identifier");

      res.status(201).json({
        success: true,
        message: "Jadwal berhasil dibuat.",
        data: jadwalResponse,
      });
    } catch (error) {
      console.error("Error creating jadwal:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server.",
        error: error.message,
      });
    }
  },
];

exports.updateJadwal = [
  logActivity(
    "UPDATE_JADWAL",
    (req) => `Memperbarui jadwal ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const jadwalId = req.params.id;
      const {
        kelas,
        mataPelajaran,
        guru,
        hari,
        jamMulai,
        jamSelesai,
        semester,
        tahunAjaran,
        isActive,
      } = req.body;

      const jadwal = await Jadwal.findById(jadwalId);
      if (!jadwal) {
        return res.status(404).json({
          success: false,
          message: "Jadwal tidak ditemukan.",
        });
      }

      if (jamMulai || jamSelesai) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        const newJamMulai = jamMulai || jadwal.jamMulai;
        const newJamSelesai = jamSelesai || jadwal.jamSelesai;

        if (!timeRegex.test(newJamMulai) || !timeRegex.test(newJamSelesai)) {
          return res.status(400).json({
            success: false,
            message: "Format waktu tidak valid. Gunakan format HH:MM",
          });
        }

        const parseTime = (time) => {
          const [hours, minutes] = time.split(":").map(Number);
          return hours * 60 + minutes;
        };

        const startMinutes = parseTime(newJamMulai);
        const endMinutes = parseTime(newJamSelesai);

        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            success: false,
            message: "Jam selesai harus lebih besar dari jam mulai.",
          });
        }

        const checkConflict = async (targetId, targetField) => {
          const existingJadwal = await Jadwal.find({
            _id: { $ne: jadwalId },
            [targetField]: targetId,
            hari: hari || jadwal.hari,
            tahunAjaran: tahunAjaran || jadwal.tahunAjaran,
            semester: semester || jadwal.semester,
            isActive: true,
          });

          for (const existing of existingJadwal) {
            const existingStart = parseTime(existing.jamMulai);
            const existingEnd = parseTime(existing.jamSelesai);

            const hasOverlap =
              startMinutes < existingEnd &&
              endMinutes > existingStart &&
              !(startMinutes === existingEnd || endMinutes === existingStart);

            if (hasOverlap) {
              return existing;
            }
          }
          return null;
        };

        const kelasConflict = await checkConflict(
          kelas || jadwal.kelas,
          "kelas"
        );
        if (kelasConflict) {
          return res.status(400).json({
            success: false,
            message: `Jadwal bentrok dengan jadwal kelas yang sudah ada`,
            conflictWith: "kelas",
          });
        }

        const guruConflict = await checkConflict(guru || jadwal.guru, "guru");
        if (guruConflict) {
          return res.status(400).json({
            success: false,
            message: `Jadwal bentrok dengan jadwal guru yang sudah ada`,
            conflictWith: "guru",
          });
        }
      }

      const updatedJadwal = await Jadwal.findByIdAndUpdate(
        jadwalId,
        {
          kelas: kelas || jadwal.kelas,
          mataPelajaran: mataPelajaran || jadwal.mataPelajaran,
          guru: guru || jadwal.guru,
          hari: hari || jadwal.hari,
          jamMulai: jamMulai || jadwal.jamMulai,
          jamSelesai: jamSelesai || jadwal.jamSelesai,
          semester: semester || jadwal.semester,
          tahunAjaran: tahunAjaran || jadwal.tahunAjaran,
          isActive: isActive !== undefined ? isActive : jadwal.isActive,
        },
        { new: true, runValidators: true }
      )
        .populate("kelas", "nama tingkat jurusan")
        .populate("mataPelajaran", "nama kode")
        .populate("guru", "name identifier");

      res.json({
        success: true,
        message: "Jadwal berhasil diupdate.",
        data: updatedJadwal,
      });
    } catch (error) {
      console.error("Error updating jadwal:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server.",
        error: error.message,
      });
    }
  },
];

exports.deleteJadwal = [
  logActivity(
    "DELETE_JADWAL",
    (req) => `Menonaktifkan (soft delete) jadwal ID: ${req.params.id}.`
  ),
  async (req, res) => {
    try {
      const jadwal = await Jadwal.findById(req.params.id);

      if (!jadwal) {
        return res.status(404).json({
          success: false,
          message: "Jadwal tidak ditemukan.",
        });
      }

      if (!jadwal.isActive) {
        return res.status(400).json({
          success: false,
          message: "Jadwal sudah nonaktif.",
        });
      }

      jadwal.isActive = false;
      await jadwal.save();

      res.json({
        success: true,
        message:
          "Jadwal berhasil dinonaktifkan. Data masih dapat dipulihkan jika diperlukan.",
      });
    } catch (error) {
      console.error("Error soft deleting jadwal:", error);
      res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server.",
        error: error.message,
      });
    }
  },
];

exports.forceDeleteJadwal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const jadwalId = req.params.id;
    const jadwal = await Jadwal.findById(jadwalId).session(session);

    if (!jadwal) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Jadwal tidak ditemukan.",
      });
    }

    const [
      jumlahAbsensi,
      jumlahSesiPresensi,
      jumlahNilai,
      jumlahTugas,
      jumlahMateri,
    ] = await Promise.all([
      Absensi.countDocuments({ jadwal: jadwalId }).session(session),
      SesiPresensi.countDocuments({ jadwal: jadwalId }).session(session),
      Nilai.countDocuments({ jadwal: jadwalId }).session(session),
      Tugas.countDocuments({ jadwal: jadwalId }).session(session),
      Materi.countDocuments({ jadwal: jadwalId }).session(session),
    ]);

    const dataRelasi = {
      absensi: jumlahAbsensi,
      sesiPresensi: jumlahSesiPresensi,
      nilai: jumlahNilai,
      tugas: jumlahTugas,
      materi: jumlahMateri,
    };

    const totalRelasi = Object.values(dataRelasi).reduce(
      (sum, val) => sum + val,
      0
    );

    if (totalRelasi > 0 && req.query.confirm !== "yes") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Jadwal ini memiliki ${totalRelasi} data terkait yang akan terhapus permanen!`,
        warning: "PERHATIAN: Penghapusan permanen tidak dapat dibatalkan!",
        dataRelasi,
        totalRelasi,
        actions: {
          confirmDelete: {
            method: "DELETE",
            url: `/super-admin/jadwal/${jadwalId}/force?confirm=yes`,
            warning: "Akan menghapus SEMUA data terkait secara permanen",
          },
          alternative: "Gunakan soft delete untuk tetap menyimpan data history",
        },
      });
    }

    if (totalRelasi === 0 || req.query.confirm === "yes") {
      await Promise.all([
        Absensi.deleteMany({ jadwal: jadwalId }, { session }),
        SesiPresensi.deleteMany({ jadwal: jadwalId }, { session }),
        Nilai.deleteMany({ jadwal: jadwalId }, { session }),
        Tugas.deleteMany({ jadwal: jadwalId }, { session }),
        Materi.deleteMany({ jadwal: jadwalId }, { session }),
      ]);

      await Jadwal.findByIdAndDelete(jadwalId).session(session);

      await session.commitTransaction();

      res.json({
        success: true,
        message: "Jadwal dan semua data terkait berhasil dihapus permanen.",
        deletedData: dataRelasi,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Error force deleting jadwal:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

exports.restoreJadwal = async (req, res) => {
  try {
    const jadwal = await Jadwal.findById(req.params.id)
      .populate("kelas", "nama isActive")
      .populate("mataPelajaran", "nama isActive")
      .populate("guru", "name isActive");

    if (!jadwal) {
      return res.status(404).json({
        success: false,
        message: "Jadwal tidak ditemukan.",
      });
    }

    if (jadwal.isActive) {
      return res.status(400).json({
        success: false,
        message: "Jadwal sudah aktif.",
      });
    }

    const validationErrors = [];

    if (!jadwal.kelas.isActive) {
      validationErrors.push("Kelas tidak aktif");
    }
    if (!jadwal.mataPelajaran.isActive) {
      validationErrors.push("Mata pelajaran tidak aktif");
    }
    if (!jadwal.guru.isActive) {
      validationErrors.push("Guru tidak aktif");
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak dapat mengaktifkan jadwal.",
        errors: validationErrors,
        recommendation:
          "Aktifkan kembali komponen yang nonaktif terlebih dahulu atau update jadwal.",
      });
    }

    const parseTime = (time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const startMinutes = parseTime(jadwal.jamMulai);
    const endMinutes = parseTime(jadwal.jamSelesai);

    const existingJadwal = await Jadwal.find({
      _id: { $ne: jadwal._id },
      hari: jadwal.hari,
      tahunAjaran: jadwal.tahunAjaran,
      semester: jadwal.semester,
      isActive: true,
      $or: [{ kelas: jadwal.kelas._id }, { guru: jadwal.guru._id }],
    });

    for (const existing of existingJadwal) {
      const existingStart = parseTime(existing.jamMulai);
      const existingEnd = parseTime(existing.jamSelesai);

      const hasOverlap =
        startMinutes < existingEnd &&
        endMinutes > existingStart &&
        !(startMinutes === existingEnd || endMinutes === existingStart);

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message:
            "Tidak dapat mengaktifkan jadwal karena bentrok dengan jadwal yang sudah ada.",
          conflictWith: existing.kelas.equals(jadwal.kelas._id)
            ? "kelas"
            : "guru",
          existingJadwal: {
            id: existing._id,
            hari: existing.hari,
            jamMulai: existing.jamMulai,
            jamSelesai: existing.jamSelesai,
          },
        });
      }
    }

    jadwal.isActive = true;
    await jadwal.save();

    res.json({
      success: true,
      message: "Jadwal berhasil diaktifkan kembali.",
      data: jadwal,
    });
  } catch (error) {
    console.error("Error restoring jadwal:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.getAllJadwal = async (req, res) => {
  try {
    const {
      isActive,
      kelasId,
      guruId,
      hari,
      semester,
      tahunAjaran,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    if (kelasId) query.kelas = kelasId;
    if (guruId) query.guru = guruId;
    if (hari) query.hari = hari;
    if (semester) query.semester = semester;
    if (tahunAjaran) query.tahunAjaran = tahunAjaran;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { hari: 1, jamMulai: 1 },
      populate: [
        { path: "kelas", select: "nama tingkat jurusan" },
        { path: "mataPelajaran", select: "nama kode" },
        { path: "guru", select: "name identifier" },
      ],
    };

    const result = await Jadwal.paginate(query, options);

    res.json(result);
  } catch (error) {
    console.error("Error getting all jadwal:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};
