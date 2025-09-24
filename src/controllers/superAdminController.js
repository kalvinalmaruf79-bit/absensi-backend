// controllers/superAdminController.js
const User = require("../models/User");
const MataPelajaran = require("../models/MataPelajaran");
const Kelas = require("../models/Kelas");
const Jadwal = require("../models/Jadwal");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose"); // Tambahkan mongoose

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
        totalPengguna: totalGuru + totalSiswa + 1, // +1 untuk superadmin
        totalMataPelajaran,
        totalKelas,
        totalJadwal,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= USER MANAGEMENT =============
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

exports.getAllUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;
    let filter = {};
    if (role && role !== "all") filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const users = await User.find(filter)
      .populate("mataPelajaran", "nama kode")
      .populate("kelas", "nama tingkat jurusan")
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(users);
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

    if (name) user.name = name;
    if (email) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;

    if (user.role === "siswa" && kelas && user.kelas?.toString() !== kelas) {
      if (user.kelas) {
        await Kelas.findByIdAndUpdate(user.kelas, {
          $pull: { siswa: user._id },
        });
      }
      user.kelas = kelas;
      await Kelas.findByIdAndUpdate(kelas, { $addToSet: { siswa: user._id } });
    }

    await user.save();

    const updatedUser = await User.findById(id)
      .populate("mataPelajaran", "nama kode")
      .populate("kelas", "nama tingkat jurusan")
      .select("-password");

    res.json({ message: "User berhasil diupdate.", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    res.json({ message: "User berhasil dinonaktifkan." });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
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

// ============= ACADEMIC CYCLE MANAGEMENT (BARU) =============
exports.processPromotion = async (req, res) => {
  const { siswaData, fromKelasId, tahunAjaran, semester } = req.body;

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
      const { siswaId, status, toKelasId } = data;
      const siswa = await User.findById(siswaId).session(session);
      if (!siswa) {
        console.warn(`Siswa dengan ID ${siswaId} tidak ditemukan.`);
        continue;
      }

      // 1. Arsipkan kelas lama ke riwayat
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

      // 2. Update status berdasarkan pilihan
      if (status === "Naik Kelas") {
        if (!toKelasId)
          throw new Error(
            `Kelas tujuan untuk siswa ${siswa.name} wajib diisi.`
          );

        // Pindahkan siswa ke kelas baru
        siswa.kelas = toKelasId;
        await Kelas.findByIdAndUpdate(
          toKelasId,
          { $addToSet: { siswa: siswaId } },
          { session }
        );
      } else if (status === "Tinggal Kelas") {
        // Siswa tetap di kelas yang sama, tidak perlu mengubah 'siswa.kelas'
        // Namun, kita tetap memprosesnya agar tercatat dalam riwayat
      } else if (status === "Lulus") {
        siswa.kelas = null; // Tidak lagi memiliki kelas aktif
        siswa.isActive = false; // Nonaktifkan akun siswa yang lulus
      }

      await siswa.save({ session });
    }

    // 3. Setelah semua siswa diproses, update daftar siswa di kelas asal
    // Siswa yang naik kelas atau lulus akan dihapus dari kelas lama
    const siswaToStay = siswaData
      .filter((s) => s.status === "Tinggal Kelas")
      .map((s) => s.siswaId);

    fromKelas.siswa = siswaToStay;
    await fromKelas.save({ session });

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

exports.getAllMataPelajaran = async (req, res) => {
  try {
    const mataPelajaran = await MataPelajaran.find({})
      .populate("guru", "name identifier")
      .populate("createdBy", "name")
      .sort({ nama: 1 });
    res.json(mataPelajaran);
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

// ============= KELAS MANAGEMENT =============
exports.createKelas = async (req, res) => {
  try {
    const { nama, tingkat, jurusan, tahunAjaran, waliKelas } = req.body;
    if (!nama || !tingkat || !jurusan || !tahunAjaran) {
      return res.status(400).json({
        message: "Nama, tingkat, jurusan, dan tahun ajaran wajib diisi.",
      });
    }
    const existing = await Kelas.findOne({ nama, tahunAjaran });
    if (existing) {
      return res.status(400).json({
        message: "Kelas dengan nama dan tahun ajaran tersebut sudah ada.",
      });
    }
    const kelas = new Kelas({
      nama,
      tingkat,
      jurusan,
      tahunAjaran,
      waliKelas,
      createdBy: req.user.id,
    });
    await kelas.save();
    const kelasResponse = await Kelas.findById(kelas._id).populate(
      "waliKelas",
      "name identifier"
    );
    res
      .status(201)
      .json({ message: "Kelas berhasil dibuat.", kelas: kelasResponse });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getAllKelas = async (req, res) => {
  try {
    const kelas = await Kelas.find({})
      .populate("waliKelas", "name identifier")
      .populate("siswa", "name identifier")
      .populate("createdBy", "name")
      .sort({ tingkat: 1, nama: 1 });
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.getKelasById = async (req, res) => {
  try {
    const kelas = await Kelas.findById(req.params.id)
      .populate("waliKelas", "name identifier")
      .populate("siswa", "name identifier")
      .populate("createdBy", "name");
    if (!kelas) {
      return res.status(404).json({ message: "Kelas tidak ditemukan." });
    }
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.updateKelas = async (req, res) => {
  try {
    const kelas = await Kelas.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!kelas) {
      return res.status(404).json({ message: "Kelas tidak ditemukan." });
    }
    res.json({ message: "Kelas berhasil diupdate.", kelas });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.deleteKelas = async (req, res) => {
  try {
    const kelas = await Kelas.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });
    if (!kelas) {
      return res.status(404).json({ message: "Kelas tidak ditemukan." });
    }
    res.json({ message: "Kelas berhasil dihapus." });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
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

exports.getAllJadwal = async (req, res) => {
  try {
    const jadwal = await Jadwal.find({ isActive: true })
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier")
      .sort({ hari: 1, jamMulai: 1 });
    res.json(jadwal);
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
