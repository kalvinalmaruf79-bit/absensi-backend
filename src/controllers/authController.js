// controllers/authController.js
const User = require("../models/User");
const Kelas = require("../models/Kelas"); // TAMBAHKAN INI
const ActivityLog = require("../models/ActivityLog");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const fs = require("fs");
const path = require("path");

exports.registerDevice = async (req, res) => {
  try {
    const { deviceToken } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ message: "Device token wajib diisi." });
    }

    const userId = req.user.id;
    await User.findByIdAndUpdate(userId, {
      $addToSet: { deviceTokens: deviceToken },
    });

    res.json({ message: "Perangkat berhasil didaftarkan." });
  } catch (error) {
    res.status(500).json({ message: "Gagal mendaftarkan perangkat." });
  }
};

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

    ActivityLog.create({
      user: user._id,
      action: "USER_LOGIN",
      details: `User login dari perangkat`,
    }).catch((err) => console.error("Gagal mencatat log login:", err));

    const userResponse = user.toObject();
    delete userResponse.password;

    // --- PERUBAHAN UTAMA: Cek status Wali Kelas ---
    if (user.role === "guru") {
      const kelasWali = await Kelas.findOne({
        waliKelas: user._id,
        isActive: true,
      });
      userResponse.isWaliKelas = !!kelasWali; // Tambahkan properti isWaliKelas
    }
    // ---------------------------------------------

    res.json({
      message: "Login berhasil",
      token,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

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
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

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
    res.status(500).json({ message: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.json({
      message: "Jika email terdaftar, link reset akan dikirim.",
    });
  }

  try {
    const resetToken = crypto.randomBytes(20).toString("hex");

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const templatePath = path.join(
      __dirname,
      "../templates/resetPassword.html"
    );
    let htmlTemplate = fs.readFileSync(templatePath, "utf-8");
    htmlTemplate = htmlTemplate.replace("{{resetURL}}", resetURL);

    await sendEmail({
      email: user.email,
      subject: "Reset Password Akun Sistem Akademik",
      html: htmlTemplate,
    });

    res.json({
      message: "Link reset password telah berhasil dikirim ke email Anda.",
    });
  } catch (error) {
    console.error("Error pada fungsi forgotPassword:", error);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500).json({ message: "Gagal mengirim email reset password." });
  }
};

exports.verifyResetToken = async (req, res) => {
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token reset tidak valid atau sudah kedaluwarsa." });
    }

    res.json({ message: "Token valid." });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token reset tidak valid atau sudah kedaluwarsa." });
    }

    if (!req.body.password) {
      return res.status(400).json({ message: "Password baru wajib diisi." });
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.isPasswordDefault = false;
    await user.save();

    res.json({ message: "Password berhasil direset." });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
