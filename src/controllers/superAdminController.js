// controllers/superAdminController.js
const Guru = require("../models/Guru");
const Siswa = require("../models/Siswa");
const SuperAdmin = require("../models/SuperAdmin");
const MataPelajaran = require("../models/MataPelajaran");
const Kelas = require("../models/Kelas");
const Jadwal = require("../models/Jadwal");
const bcrypt = require("bcryptjs");

// ============= DASHBOARD =============
exports.getDashboard = async (req, res) => {
  try {
    const [
      totalSuperAdmin,
      totalGuru,
      totalSiswa,
      totalMataPelajaran,
      totalKelas,
      totalJadwal,
    ] = await Promise.all([
      SuperAdmin.countDocuments({ isActive: true }),
      Guru.countDocuments({ isActive: true }),
      Siswa.countDocuments({ isActive: true }),
      MataPelajaran.countDocuments({ isActive: true }),
      Kelas.countDocuments({ isActive: true }),
      Jadwal.countDocuments({ isActive: true }),
    ]);

    res.json({
      message: "Dashboard Super Admin",
      data: {
        totalSuperAdmin,
        totalGuru,
        totalSiswa,
        totalPengguna: totalSuperAdmin + totalGuru + totalSiswa,
        totalMataPelajaran,
        totalKelas,
        totalJadwal,
      },
    });
  } catch (error) {
    console.error("Error getting super admin dashboard:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= USER MANAGEMENT =============
// Membuat akun siswa
exports.createSiswa = async (req, res) => {
  try {
    const { name, email, identifier, kelas, password } = req.body;

    if (!name || !email || !identifier || !kelas || !password) {
      return res.status(400).json({
        message: "Nama, email, NIS, kelas, dan password wajib diisi.",
      });
    }

    // Cek duplikasi
    const existing = await Siswa.findOne({
      $or: [{ email }, { identifier }],
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "Email atau NIS sudah digunakan." });
    }

    const kelasData = await Kelas.findById(kelas);
    if (!kelasData) {
      return res.status(400).json({ message: "Kelas tidak ditemukan." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newSiswa = new Siswa({
      name,
      email,
      identifier,
      password: hashedPassword,
      kelas,
      isPasswordDefault: false, // Diasumsikan admin membuat password yg proper
    });

    await newSiswa.save();

    await Kelas.findByIdAndUpdate(kelas, {
      $addToSet: { siswa: newSiswa._id },
    });

    res.status(201).json({
      message: "Siswa berhasil dibuat.",
      siswa: await Siswa.findById(newSiswa._id)
        .populate("kelas", "nama tingkat jurusan")
        .select("-password"),
    });
  } catch (error) {
    console.error("Error creating siswa:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
// Membuat akun guru
exports.createGuru = async (req, res) => {
  try {
    const { name, email, identifier } = req.body;

    if (!name || !email || !identifier) {
      return res
        .status(400)
        .json({ message: "Nama, email, dan NIP wajib diisi." });
    }

    // Cek duplikasi
    const existing = await Guru.findOne({
      $or: [{ email }, { identifier }],
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "Email atau NIP sudah digunakan." });
    }

    // Password default: identifier (NIP)
    const hashedPassword = await bcrypt.hash(identifier, 10);

    const newGuru = new Guru({
      name,
      email,
      identifier,
      password: hashedPassword,
      isPasswordDefault: true,
    });

    await newGuru.save();

    res.status(201).json({
      message: "Guru berhasil dibuat.",
      guru: await Guru.findById(newGuru._id).select("-password"),
    });
  } catch (error) {
    console.error("Error creating guru:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Melihat semua user
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;

    let filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    let users = [];

    if (!role || role === "all" || role === "super_admin") {
      const superAdmins = await SuperAdmin.find(filter).select("-password");
      users = users.concat(superAdmins);
    }
    if (!role || role === "all" || role === "guru") {
      const gurus = await Guru.find(filter)
        .populate("mataPelajaran", "nama kode")
        .select("-password");
      users = users.concat(gurus);
    }
    if (!role || role === "all" || role === "siswa") {
      const siswas = await Siswa.find(filter)
        .populate("kelas", "nama tingkat jurusan")
        .select("-password");
      users = users.concat(siswas);
    }

    users.sort((a, b) => b.createdAt - a.createdAt);

    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, isActive, kelas } = req.body;

    let user =
      (await SuperAdmin.findById(id)) ||
      (await Guru.findById(id)) ||
      (await Siswa.findById(id));

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    // Update basic info
    if (name) user.name = name;
    if (email) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;

    if (user.role === "siswa" && kelas) {
      // Remove from old class
      if (user.kelas) {
        await Kelas.findByIdAndUpdate(user.kelas, {
          $pull: { siswa: user._id },
        });
      }

      // Add to new class
      user.kelas = kelas;
      await Kelas.findByIdAndUpdate(kelas, {
        $addToSet: { siswa: user._id },
      });
    }

    await user.save();

    let updatedUser;
    if (user.role === "super_admin") {
      updatedUser = await SuperAdmin.findById(id).select("-password");
    } else if (user.role === "guru") {
      updatedUser = await Guru.findById(id)
        .populate("mataPelajaran", "nama kode")
        .select("-password");
    } else {
      updatedUser = await Siswa.findById(id)
        .populate("kelas", "nama tingkat jurusan")
        .select("-password");
    }

    res.json({
      message: "User berhasil diupdate.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Reset password user
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;

    let user =
      (await SuperAdmin.findById(id)) ||
      (await Guru.findById(id)) ||
      (await Siswa.findById(id));
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    // Reset password ke identifier
    const hashedPassword = await bcrypt.hash(user.identifier, 10);
    user.password = hashedPassword;
    user.isPasswordDefault = true;

    await user.save();

    res.json({ message: "Password berhasil direset ke identifier." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= MATA PELAJARAN MANAGEMENT =============

// Membuat mata pelajaran
exports.createMataPelajaran = async (req, res) => {
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

    res.status(201).json({
      message: "Mata pelajaran berhasil dibuat.",
      mataPelajaran,
    });
  } catch (error) {
    console.error("Error creating mata pelajaran:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Melihat semua mata pelajaran
exports.getAllMataPelajaran = async (req, res) => {
  try {
    const { isActive } = req.query;

    let filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const mataPelajaran = await MataPelajaran.find(filter)
      .populate("guru", "name identifier")
      .populate("createdBy", "name")
      .sort({ nama: 1 });

    res.json(mataPelajaran);
  } catch (error) {
    console.error("Error getting mata pelajaran:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Assign guru ke mata pelajaran
exports.assignGuruMataPelajaran = async (req, res) => {
  try {
    const { mataPelajaranId, guruId } = req.body;

    if (!mataPelajaranId || !guruId) {
      return res
        .status(400)
        .json({ message: "Mata pelajaran dan guru wajib diisi." });
    }

    const mataPelajaran = await MataPelajaran.findById(mataPelajaranId);
    if (!mataPelajaran) {
      return res
        .status(404)
        .json({ message: "Mata pelajaran tidak ditemukan." });
    }

    const guru = await Guru.findById(guruId);
    if (!guru) {
      return res.status(404).json({ message: "Guru tidak ditemukan." });
    }

    // Add mata pelajaran to guru
    await Guru.findByIdAndUpdate(guruId, {
      $addToSet: { mataPelajaran: mataPelajaranId },
    });

    // Add guru to mata pelajaran
    await MataPelajaran.findByIdAndUpdate(mataPelajaranId, {
      $addToSet: { guru: guruId },
    });

    res.json({ message: "Guru berhasil diassign ke mata pelajaran." });
  } catch (error) {
    console.error("Error assigning guru mata pelajaran:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= KELAS MANAGEMENT =============

// Membuat kelas
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

    res.status(201).json({
      message: "Kelas berhasil dibuat.",
      kelas: await Kelas.findById(kelas._id).populate(
        "waliKelas",
        "name identifier"
      ),
    });
  } catch (error) {
    console.error("Error creating kelas:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Melihat semua kelas
exports.getAllKelas = async (req, res) => {
  try {
    const { tahunAjaran, tingkat, isActive } = req.query;

    let filter = {};
    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;
    if (tingkat) filter.tingkat = tingkat;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const kelas = await Kelas.find(filter)
      .populate("waliKelas", "name identifier")
      .populate("siswa", "name identifier")
      .populate("createdBy", "name")
      .sort({ tingkat: 1, nama: 1 });

    res.json(kelas);
  } catch (error) {
    console.error("Error getting kelas:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ============= JADWAL MANAGEMENT =============

// Membuat jadwal
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

    // Validasi format waktu
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(jamMulai) || !timeRegex.test(jamSelesai)) {
      return res
        .status(400)
        .json({ message: "Format jam tidak valid. Gunakan HH:MM" });
    }

    // Cek apakah jam mulai < jam selesai
    if (jamMulai >= jamSelesai) {
      return res
        .status(400)
        .json({ message: "Jam mulai harus lebih awal dari jam selesai." });
    }

    // Validasi eksistensi referensi
    const [kelasData, mataPelajaranData, guruData] = await Promise.all([
      Kelas.findById(kelas),
      MataPelajaran.findById(mataPelajaran),
      Guru.findOne({ _id: guru }),
    ]);

    if (!kelasData)
      return res.status(404).json({ message: "Kelas tidak ditemukan." });
    if (!mataPelajaranData)
      return res
        .status(404)
        .json({ message: "Mata pelajaran tidak ditemukan." });
    if (!guruData)
      return res.status(404).json({ message: "Guru tidak ditemukan." });

    // Validasi guru mengampu mata pelajaran
    if (!guruData.mataPelajaran.includes(mataPelajaran)) {
      return res
        .status(400)
        .json({ message: "Guru tidak mengampu mata pelajaran ini." });
    }

    // Cek konflik jadwal untuk kelas
    const conflictKelas = await Jadwal.findOne({
      kelas,
      hari,
      tahunAjaran,
      semester,
      isActive: true,
      $or: [{ jamMulai: { $lt: jamSelesai }, jamSelesai: { $gt: jamMulai } }],
    });

    if (conflictKelas) {
      return res.status(400).json({
        message: "Jadwal bentrok dengan jadwal kelas yang sudah ada.",
      });
    }

    // Cek konflik jadwal untuk guru
    const conflictGuru = await Jadwal.findOne({
      guru,
      hari,
      tahunAjaran,
      semester,
      isActive: true,
      $or: [{ jamMulai: { $lt: jamSelesai }, jamSelesai: { $gt: jamMulai } }],
    });

    if (conflictGuru) {
      return res
        .status(400)
        .json({ message: "Guru sudah memiliki jadwal pada jam tersebut." });
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

    res.status(201).json({
      message: "Jadwal berhasil dibuat.",
      jadwal: await Jadwal.findById(jadwal._id)
        .populate("kelas", "nama tingkat jurusan")
        .populate("mataPelajaran", "nama kode")
        .populate("guru", "name identifier"),
    });
  } catch (error) {
    console.error("Error creating jadwal:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Melihat semua jadwal
exports.getAllJadwal = async (req, res) => {
  try {
    const { kelas, guru, hari, tahunAjaran, semester } = req.query;

    let filter = {};
    if (kelas) filter.kelas = kelas;
    if (guru) filter.guru = guru;
    if (hari) filter.hari = hari;
    if (tahunAjaran) filter.tahunAjaran = tahunAjaran;
    if (semester) filter.semester = semester;
    filter.isActive = true;

    const jadwal = await Jadwal.find(filter)
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier")
      .sort({ hari: 1, jamMulai: 1 });

    res.json(jadwal);
  } catch (error) {
    console.error("Error getting jadwal:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Update jadwal
exports.updateJadwal = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const jadwal = await Jadwal.findById(id);
    if (!jadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan." });
    }

    // Validasi jam jika diubah
    if (updateData.jamMulai || updateData.jamSelesai) {
      const jamMulai = updateData.jamMulai || jadwal.jamMulai;
      const jamSelesai = updateData.jamSelesai || jadwal.jamSelesai;

      if (jamMulai >= jamSelesai) {
        return res
          .status(400)
          .json({ message: "Jam mulai harus lebih awal dari jam selesai." });
      }
    }

    Object.assign(jadwal, updateData);
    await jadwal.save();

    res.json({
      message: "Jadwal berhasil diupdate.",
      jadwal: await Jadwal.findById(id)
        .populate("kelas", "nama tingkat jurusan")
        .populate("mataPelajaran", "nama kode")
        .populate("guru", "name identifier"),
    });
  } catch (error) {
    console.error("Error updating jadwal:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Delete jadwal
exports.deleteJadwal = async (req, res) => {
  try {
    const { id } = req.params;

    const jadwal = await Jadwal.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!jadwal) {
      return res.status(404).json({ message: "Jadwal tidak ditemukan." });
    }

    res.json({ message: "Jadwal berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting jadwal:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
