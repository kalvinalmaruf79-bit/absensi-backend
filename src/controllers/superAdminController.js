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
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const fs = require("fs");

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
exports.processPromotion = async (req, res) => {
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
};

// ============= PENGATURAN APLIKASI =============
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil pengaturan aplikasi." });
  }
};

exports.updateSettings = async (req, res) => {
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
};

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

// ============= DASHBOARD =============
exports.getDashboard = async (req, res) => {
  try {
    const [totalGuru, totalSiswa, totalMataPelajaran, totalKelas, totalJadwal] =
      await Promise.all([
        User.countDocuments({ role: "guru", isActive: true }),
        User.countDocuments({ role: "siswa", isActive: true }),
        MataPelajaran.countDocuments({ isActive: true }),
        Kelas.countDocuments({ isActive: true }),
        Jadwal.countDocuments({ isActive: true }),
      ]);

    res.json({
      message: "Dashboard Super Admin",
      data: {
        totalGuru,
        totalSiswa,
        totalPengguna: totalGuru + totalSiswa + 1,
        totalMataPelajaran,
        totalKelas,
        totalJadwal,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= USER MANAGEMENT (DIPERBARUI) =============
exports.importUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File Excel tidak ditemukan." });
  }

  const workbook = new ExcelJS.Workbook();
  const report = {
    berhasil: 0,
    gagal: 0,
    errors: [],
  };

  try {
    // --- PERBAIKAN: Baca dari buffer memori, bukan dari file path ---
    await workbook.xlsx.load(req.file.buffer);
    // ----------------------------------------------------------------

    const worksheet = workbook.getWorksheet(1);
    const bulkOps = [];
    const identifiers = new Set();
    const emails = new Set();

    const kelasCache = new Map();
    const semuaKelas = await Kelas.find({}).select("nama _id");
    semuaKelas.forEach((k) => kelasCache.set(k.nama.toLowerCase(), k._id));

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const name = row.getCell(1).value?.toString().trim();
      const email = row.getCell(2).value?.toString().trim();
      const identifier = row.getCell(3).value?.toString().trim();
      const role = row.getCell(4).value?.toString().trim().toLowerCase();
      const kelasNama = row.getCell(5).value?.toString().trim();

      if (!name || !email || !identifier || !role) {
        report.gagal++;
        report.errors.push(
          `Baris ${rowNumber}: Data tidak lengkap (nama, email, identifier, role wajib diisi).`
        );
        continue;
      }
      if (!["siswa", "guru"].includes(role)) {
        report.gagal++;
        report.errors.push(
          `Baris ${rowNumber}: Role tidak valid, harus 'siswa' atau 'guru'.`
        );
        continue;
      }
      if (identifiers.has(identifier) || emails.has(email)) {
        report.gagal++;
        report.errors.push(
          `Baris ${rowNumber}: Email atau Identifier duplikat di dalam file.`
        );
        continue;
      }
      identifiers.add(identifier);
      emails.add(email);

      let kelasId = null;
      if (role === "siswa") {
        if (!kelasNama) {
          report.gagal++;
          report.errors.push(
            `Baris ${rowNumber}: Nama kelas wajib diisi untuk siswa.`
          );
          continue;
        }
        kelasId = kelasCache.get(kelasNama.toLowerCase());
        if (!kelasId) {
          report.gagal++;
          report.errors.push(
            `Baris ${rowNumber}: Kelas '${kelasNama}' tidak ditemukan.`
          );
          continue;
        }
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
    }

    res.status(200).json({
      message: "Proses impor selesai.",
      report,
    });
  } catch (error) {
    // --- PERBAIKAN: Tidak perlu lagi menghapus file karena tidak ada di disk ---
    res.status(500).json({
      message: "Terjadi kesalahan saat memproses file Excel.",
      error: error.message,
    });
  }
};

exports.createSiswa = async (req, res) => {
  try {
    const { name, email, identifier, kelas, password } = req.body;

    if (!name || !email || !identifier || !kelas || !password) {
      return res.status(400).json({ message: "Semua field wajib diisi." });
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const newSiswa = new User({
      name,
      email,
      identifier,
      password: hashedPassword,
      kelas,
      role: "siswa",
      isPasswordDefault: false,
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
};

exports.createGuru = async (req, res) => {
  try {
    const { name, email, identifier } = req.body;
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

    const hashedPassword = await bcrypt.hash(identifier, 10);
    const newGuru = new User({
      name,
      email,
      identifier,
      password: hashedPassword,
      role: "guru",
      isPasswordDefault: true,
    });
    await newGuru.save();

    const guruResponse = await User.findById(newGuru._id).select("-password");

    res
      .status(201)
      .json({ message: "Guru berhasil dibuat.", guru: guruResponse });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

/**
 * @summary Get All Users with Pagination and Search
 */
exports.getAllUsers = async (req, res) => {
  try {
    // 1. Ambil parameter query untuk pagination dan filter
    const {
      role,
      isActive,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // 2. Buat objek query dasar untuk Mongoose
    let query = {};
    if (role && role !== "all") {
      query.role = role;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    if (search) {
      const searchRegex = new RegExp(search, "i"); // 'i' for case-insensitive
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { identifier: searchRegex },
      ];
    }

    // 3. Konfigurasi options untuk mongoose-paginate-v2
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 },
      populate: [
        { path: "mataPelajaran", select: "nama kode" },
        { path: "kelas", select: "nama tingkat jurusan" },
      ],
      select: "-password", // Jangan pernah kirim password ke client
    };

    // 4. Jalankan query menggunakan metode .paginate()
    const result = await User.paginate(query, options);

    // 5. Kirim hasil sebagai response
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

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, isActive, kelas } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    // --- LOGIKA BARU UNTUK RIWAYAT KELAS ---
    if (user.role === "siswa" && kelas && user.kelas?.toString() !== kelas) {
      // Ambil pengaturan semester & tahun ajaran aktif
      const settings = await Settings.getSettings();

      // Cek apakah riwayat untuk periode ini sudah ada untuk menghindari duplikat
      const sudahAdaDiRiwayat = user.riwayatKelas.some(
        (riwayat) =>
          riwayat.kelas.equals(user.kelas) &&
          riwayat.tahunAjaran === settings.tahunAjaranAktif &&
          riwayat.semester === settings.semesterAktif
      );

      // Jika ada kelas lama dan belum tercatat di riwayat untuk periode ini
      if (user.kelas && !sudahAdaDiRiwayat) {
        user.riwayatKelas.push({
          kelas: user.kelas,
          tahunAjaran: settings.tahunAjaranAktif,
          semester: settings.semesterAktif,
        });
      }
      // ---------------------------------------------

      // Proses pemindahan siswa dari kelas lama ke kelas baru
      if (user.kelas) {
        await Kelas.findByIdAndUpdate(user.kelas, {
          $pull: { siswa: user._id },
        });
      }
      user.kelas = kelas;
      await Kelas.findByIdAndUpdate(kelas, { $addToSet: { siswa: user._id } });
    }

    // Update data umum
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
};

exports.deleteUser = async (req, res) => {
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
};

exports.resetPassword = async (req, res) => {
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
};

// ============= MATA PELAJARAN MANAGEMENT =============
exports.createMataPelajaran = async (req, res) => {
  try {
    const { nama, kode, deskripsi } = req.body;
    if (!nama || !kode) {
      return res
        .status(400)
        .json({ message: "Nama dan kode mata pelajaran wajib diisi." });
    }
    const existing = await MataPelajaran.findOne({ $or: [{ nama }, { kode }] });
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
};

/**
 * @summary Get All Mata Pelajaran with Pagination and Search
 */
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

    // Manually add guruCount to each document
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

exports.updateMataPelajaran = async (req, res) => {
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
};

exports.deleteMataPelajaran = async (req, res) => {
  try {
    const mataPelajaran = await MataPelajaran.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });
    if (!mataPelajaran) {
      return res
        .status(404)
        .json({ message: "Mata pelajaran tidak ditemukan." });
    }
    res.json({ message: "Mata pelajaran berhasil dihapus." });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.assignGuruMataPelajaran = async (req, res) => {
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
};

exports.unassignGuruMataPelajaran = async (req, res) => {
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
};

// ============= KELAS MANAGEMENT (COMPLETE WITH MULTI-LEVEL DELETE) =============

// FUNGSI YANG HILANG - DITAMBAHKAN
/**
 * Create a new Kelas
 */
exports.createKelas = async (req, res) => {
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
};

// FUNGSI YANG HILANG - DITAMBAHKAN
/**
 * Get Kelas by ID
 */
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

// FUNGSI YANG HILANG - DITAMBAHKAN
/**
 * Update Kelas
 */
exports.updateKelas = async (req, res) => {
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
};

/**
 * @summary Get All Kelas with Pagination and Search
 */
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
    // By default, filter by active. If includeInactive is true, don't filter by isActive.
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
      // Custom population to get the count of students
      // This is a more advanced feature of the plugin
      customLabels: {
        docs: "data",
        totalDocs: "totalData",
      },
    };

    const result = await Kelas.paginate(query, options);

    // Manually add siswaCount to each document
    const populatedResult = await Kelas.populate(result.data, {
      path: "siswa",
      select: "_id", // Only need the ID to count
    });

    const finalData = populatedResult.map((kelas) => {
      const kelasObj = kelas.toObject();
      kelasObj.jumlahSiswa = kelasObj.siswa.length;
      delete kelasObj.siswa; // Remove the full siswa array from final response
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

/**
 * Soft Delete Kelas - Nonaktifkan kelas (default behavior)
 */
exports.deleteKelas = async (req, res) => {
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

    // Cek apakah kelas masih memiliki siswa aktif
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

    // Soft delete
    kelas.isActive = false;
    await kelas.save();

    // Nonaktifkan juga jadwal terkait
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
};

/**
 * Force Delete Kelas - Hapus permanen dengan validasi
 * Query: ?force=true
 */
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

    // Hitung semua relasi data
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

    // Jika ada data terkait, berikan warning dan opsi
    if (totalRelasi > 0 && req.query.confirm !== "yes") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Kelas ini memiliki ${totalRelasi} data terkait yang akan terhapus permanen!`,
        warning: "PERHATIAN: Penghapusan permanen tidak dapat dibatalkan!",
        dataRelasi,
        totalRelasi,
        actions: {
          // Jika mau tetap force delete, kirim confirmation
          confirmDelete: {
            method: "DELETE",
            url: `/super-admin/kelas/${kelasId}/force?confirm=yes`,
            warning: "Akan menghapus SEMUA data terkait secara permanen",
          },
          // Atau pindahkan siswa dulu
          alternative:
            "Pindahkan siswa ke kelas lain terlebih dahulu, lalu hapus kelas kosong",
        },
      });
    }

    // Jika tidak ada data terkait, langsung hapus
    if (totalRelasi === 0 || req.query.confirm === "yes") {
      // Hapus semua data terkait dulu
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

      // Hapus kelas
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

/**
 * Restore Kelas - Aktifkan kembali kelas yang di-soft delete
 */
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

    // Validasi: Cek apakah wali kelas masih aktif
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

    // Restore kelas
    kelas.isActive = true;
    await kelas.save();

    // Aktifkan kembali jadwal terkait (opsional)
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

/**
 * Get Kelas Stats - Info detail sebelum delete
 */
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

// ============= JADWAL MANAGEMENT =============
exports.createJadwal = async (req, res) => {
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
      return res
        .status(400)
        .json({ message: "Semua field jadwal wajib diisi." });
    }

    const guruData = await User.findOne({ _id: guru, role: "guru" });
    if (!guruData) {
      return res.status(404).json({ message: "Guru tidak ditemukan." });
    }
    if (!guruData.mataPelajaran.includes(mataPelajaran)) {
      return res
        .status(400)
        .json({ message: "Guru tidak mengampu mata pelajaran ini." });
    }

    const conflict = await Jadwal.findOne({
      $or: [
        {
          kelas,
          hari,
          tahunAjaran,
          semester,
          jamMulai: { $lt: jamSelesai },
          jamSelesai: { $gt: jamMulai },
        },
        {
          guru,
          hari,
          tahunAjaran,
          semester,
          jamMulai: { $lt: jamSelesai },
          jamSelesai: { $gt: jamMulai },
        },
      ],
    });
    if (conflict) {
      return res.status(400).json({
        message:
          "Jadwal bentrok dengan jadwal yang sudah ada untuk kelas atau guru.",
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

    res
      .status(201)
      .json({ message: "Jadwal berhasil dibuat.", jadwal: jadwalResponse });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

/**
 * @summary Get All Jadwal with Pagination and Advanced Filtering
 */
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
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.updateJadwal = async (req, res) => {
  try {
    const jadwal = await Jadwal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    })
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier");
    if (!jadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan." });
    }
    res.json({ message: "Jadwal berhasil diupdate.", jadwal });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.deleteJadwal = async (req, res) => {
  try {
    const jadwal = await Jadwal.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });
    if (!jadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan." });
    }
    res.json({ message: "Jadwal berhasil dihapus." });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
