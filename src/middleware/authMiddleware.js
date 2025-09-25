// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Diubah ke User
const Kelas = require("../models/Kelas"); // Tambahkan model Kelas

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) {
    return res
      .status(401)
      .json({ message: "Akses ditolak: Token tidak ditemukan." });
  }
  try {
    const tokenParts = token.split(" ");
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      return res.status(400).json({
        message: "Format token tidak valid. Gunakan format 'Bearer <token>'.",
      });
    }
    const decoded = jwt.verify(tokenParts[1], process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Token tidak valid atau sudah kedaluwarsa." });
  }
};

const verifySuperAdmin = (req, res, next) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      message:
        "Akses ditolak: Hanya Super Admin yang dapat mengakses fitur ini.",
    });
  }
  next();
};

const verifyGuru = (req, res, next) => {
  if (req.user.role !== "guru") {
    return res.status(403).json({
      message: "Akses ditolak: Hanya Guru yang dapat mengakses fitur ini.",
    });
  }
  next();
};

const verifySiswa = (req, res, next) => {
  if (req.user.role !== "siswa") {
    return res.status(403).json({
      message: "Akses ditolak: Hanya Siswa yang dapat mengakses fitur ini.",
    });
  }
  next();
};

const verifyAdminOrGuru = (req, res, next) => {
  if (!["super_admin", "guru"].includes(req.user.role)) {
    return res.status(403).json({
      message:
        "Akses ditolak: Hanya Super Admin atau Guru yang dapat mengakses fitur ini.",
    });
  }
  next();
};

const verifyAnyUser = (req, res, next) => {
  if (!["super_admin", "guru", "siswa"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Akses ditolak: Role tidak valid." });
  }
  next();
};

// **MIDDLEWARE BARU UNTUK WALI KELAS**
const verifyWaliKelas = async (req, res, next) => {
  try {
    // Super admin dapat melewati verifikasi ini
    if (req.user.role === "super_admin") {
      return next();
    }

    const kelas = await Kelas.findOne({
      waliKelas: req.user.id,
      isActive: true,
    });
    if (!kelas) {
      return res
        .status(403)
        .json({ message: "Akses ditolak: Anda bukan wali kelas aktif." });
    }
    // Simpan data kelas yang diampu untuk digunakan di controller
    req.kelasWali = kelas;
    next();
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Gagal memverifikasi status wali kelas." });
  }
};

const checkUserActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id); // Disederhanakan
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    if (!user.isActive) {
      return res.status(403).json({
        message: "Akun Anda telah dinonaktifkan. Hubungi administrator.",
      });
    }
    req.userDetail = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Error checking user status." });
  }
};

const checkOwnership = (model) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const userId = req.user.id;
      if (req.user.role === "super_admin") return next();
      const resource = await model.findById(resourceId);
      if (!resource)
        return res.status(404).json({ message: "Resource tidak ditemukan." });
      const ownerFields = ["user", "siswa", "guru", "createdBy", "dibuatOleh"];
      let isOwner = false;
      for (let field of ownerFields) {
        if (resource[field] && resource[field].toString() === userId) {
          isOwner = true;
          break;
        }
      }
      if (!isOwner) {
        return res.status(403).json({
          message:
            "Akses ditolak: Anda tidak memiliki hak untuk mengakses resource ini.",
        });
      }
      next();
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error checking resource ownership." });
    }
  };
};

module.exports = {
  authMiddleware,
  verifySuperAdmin,
  verifyGuru,
  verifySiswa,
  verifyAdminOrGuru,
  verifyAnyUser,
  verifyWaliKelas, // Ekspor middleware baru
  checkUserActive,
  checkOwnership,
};
