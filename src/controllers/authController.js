// controllers/authController.js
const User = require("../models/User");
const Kelas = require("../models/Kelas");
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

    if (!deviceToken || deviceToken.trim() === "") {
      return res.status(400).json({ message: "Device token wajib diisi." });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    const tokenExists =
      user.deviceTokens && user.deviceTokens.includes(deviceToken);

    if (!tokenExists) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { deviceTokens: deviceToken },
      });

      console.log(
        `✅ Device token berhasil didaftarkan untuk user ${userId}: ${deviceToken}`
      );

      ActivityLog.create({
        user: userId,
        action: "REGISTER_DEVICE",
        details: `Device token didaftarkan: ${deviceToken.substring(0, 10)}...`,
      }).catch((err) =>
        console.error("Gagal mencatat log register device:", err)
      );

      res.json({
        message: "Perangkat berhasil didaftarkan.",
        deviceToken: deviceToken,
      });
    } else {
      console.log(`ℹ️ Device token sudah terdaftar untuk user ${userId}`);
      res.json({
        message: "Perangkat sudah terdaftar sebelumnya.",
        deviceToken: deviceToken,
      });
    }
  } catch (error) {
    console.error("❌ Error registerDevice:", error);
    res.status(500).json({
      message: "Gagal mendaftarkan perangkat.",
      error: error.message,
    });
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

    if (user.role === "guru") {
      const kelasWali = await Kelas.findOne({
        waliKelas: user._id,
        isActive: true,
      });
      userResponse.isWaliKelas = !!kelasWali;
    }

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

// ========== UPDATED: Forgot Password - Kirim Kode 6 Digit ==========
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.json({
      message: "Jika email terdaftar, kode verifikasi akan dikirim.",
    });
  }

  try {
    // Generate kode 6 digit
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash kode dan simpan
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetCode)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 menit

    await user.save({ validateBeforeSave: false });

    // Kirim email dengan kode
    const templatePath = path.join(
      __dirname,
      "../templates/resetPassword.html"
    );
    let htmlTemplate = fs.readFileSync(templatePath, "utf-8");
    htmlTemplate = htmlTemplate.replace("{{resetCode}}", resetCode);

    await sendEmail({
      email: user.email,
      subject: "Kode Verifikasi Reset Password",
      html: htmlTemplate,
    });

    res.json({
      message: "Kode verifikasi telah berhasil dikirim ke email Anda.",
    });
  } catch (error) {
    console.error("Error pada fungsi forgotPassword:", error);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500).json({ message: "Gagal mengirim kode verifikasi." });
  }
};

// ========== UPDATED: Verify Reset Code ==========
exports.verifyResetCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: "Kode verifikasi tidak valid." });
    }

    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedCode,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Kode verifikasi tidak valid atau sudah kedaluwarsa.",
      });
    }

    // Generate temporary token untuk proses reset password
    const tempToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTempToken = crypto
      .createHash("sha256")
      .update(tempToken)
      .digest("hex");

    await user.save({ validateBeforeSave: false });

    res.json({
      message: "Kode verifikasi valid.",
      tempToken: tempToken,
    });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ========== UPDATED: Reset Password dengan Temp Token ==========
exports.resetPassword = async (req, res) => {
  try {
    const { tempToken, password } = req.body;

    if (!tempToken || !password) {
      return res.status(400).json({ message: "Data tidak lengkap." });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(tempToken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordTempToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Sesi reset password tidak valid atau sudah kedaluwarsa.",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordTempToken = undefined;
    user.resetPasswordExpire = undefined;
    user.isPasswordDefault = false;
    await user.save();

    res.json({ message: "Password berhasil direset." });
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};
