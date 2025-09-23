// controllers/authController.js (Updated)
const mongoose = require("mongoose");
const Guru = require("../models/Guru");
const Siswa = require("../models/Siswa");
const SuperAdmin = require("../models/SuperAdmin");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const findUserByIdentifier = async (identifier) => {
  let user = await SuperAdmin.findOne({ identifier, isActive: true });
  if (user) return user;
  user = await Guru.findOne({ identifier, isActive: true }).populate(
    "mataPelajaran",
    "nama kode"
  );
  if (user) return user;
  user = await Siswa.findOne({ identifier, isActive: true }).populate(
    "kelas",
    "nama tingkat jurusan"
  );
  return user;
};

const findUserByIdAndRole = async (id, role) => {
  switch (role) {
    case "super_admin":
      return await SuperAdmin.findById(id);
    case "guru":
      return await Guru.findById(id)
        .populate("mataPelajaran", "nama kode")
        .select("-password");
    case "siswa":
      return await Siswa.findById(id)
        .populate("kelas", "nama tingkat jurusan")
        .select("-password");
    default:
      return null;
  }
};

// Login user (semua role)
exports.loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Identifier dan Password wajib diisi" });
    }

    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res
        .status(400)
        .json({ message: "User tidak ditemukan atau tidak aktif" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password salah" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Remove password from response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      identifier: user.identifier,
      role: user.role,
      isPasswordDefault: user.isPasswordDefault,
      ...(user.role === "guru" && { mataPelajaran: user.mataPelajaran }),
      ...(user.role === "siswa" && { kelas: user.kelas }),
    };

    res.json({
      message: "Login berhasil",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Error saat login:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await findUserByIdAndRole(req.user.id, req.user.role);

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error mengambil profil pengguna:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Change password (untuk semua user)
exports.changePassword = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Password lama dan baru wajib diisi" });
    }

    const user = await findUserByIdAndRole(id, role);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.isPasswordDefault = false; // Mark bahwa user sudah ganti password
    await user.save();

    res.json({ message: "Password berhasil diganti" });
  } catch (error) {
    console.error("Error mengganti password:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// First time password change (untuk user baru)
exports.firstTimePasswordChange = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "Password baru wajib diisi" });
    }

    const user = await findUserByIdAndRole(id, role);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    if (!user.isPasswordDefault) {
      return res
        .status(400)
        .json({ message: "Password sudah pernah diganti sebelumnya" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.isPasswordDefault = false;
    await user.save();

    res.json({ message: "Password berhasil diatur untuk pertama kali" });
  } catch (error) {
    console.error("Error first time password change:", error);
    res.status(500).json({ message: "Server error" });
  }
};
