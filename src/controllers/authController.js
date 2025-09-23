// controllers/authController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Login user (semua role)
exports.loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Identifier dan Password wajib diisi" });
    }

    const user = await User.findOne({ identifier, isActive: true })
      .populate("mataPelajaran", "nama kode")
      .populate("kelas", "nama tingkat jurusan");

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

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: "Login berhasil",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Error saat login:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("mataPelajaran", "nama kode")
      .populate("kelas", "nama tingkat jurusan");

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error mengambil profil pengguna:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// Change password (untuk semua user)
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Password lama dan baru wajib diisi" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.isPasswordDefault = false;
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
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "Password baru wajib diisi" });
    }

    const user = await User.findById(req.user.id);
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
