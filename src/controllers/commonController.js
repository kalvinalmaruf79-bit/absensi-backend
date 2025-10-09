// src/controllers/commonController.js
const Settings = require("../models/Settings");
const User = require("../models/User");

/**
 * @summary GET /api/common/settings
 * @description Mengembalikan tahun ajaran dan semester yang saat ini aktif secara global.
 * @access  Private (Semua Role)
 */
exports.getGlobalSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      tahunAjaranAktif: settings.tahunAjaranAktif,
      semesterAktif: settings.semesterAktif,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil pengaturan.", error: error.message });
  }
};

/**
 * @summary GET /api/common/academic-history
 * @description Mengembalikan daftar tahun ajaran dan semester yang pernah diikuti siswa.
 * @access  Private (Hanya Siswa)
 */
exports.getSiswaAcademicHistory = async (req, res) => {
  try {
    if (req.user.role !== "siswa") {
      return res.status(403).json({ message: "Akses ditolak untuk role ini." });
    }

    const siswa = await User.findById(req.user.id).populate(
      "kelas",
      "tahunAjaran"
    );
    if (!siswa) {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    const history = new Set();

    // 1. Tambahkan dari riwayatKelas
    siswa.riwayatKelas.forEach((riwayat) => {
      history.add(`${riwayat.tahunAjaran}|${riwayat.semester}`);
    });

    // 2. Tambahkan periode dari kelas aktif saat ini
    if (siswa.kelas && siswa.kelas.tahunAjaran) {
      // Asumsikan selalu ada semester ganjil dan genap untuk tahun ajaran aktif
      history.add(`${siswa.kelas.tahunAjaran}|ganjil`);
      history.add(`${siswa.kelas.tahunAjaran}|genap`);
    }

    // 3. Format dan urutkan hasilnya
    const formattedHistory = Array.from(history)
      .map((item) => {
        const [tahunAjaran, semester] = item.split("|");
        return { tahunAjaran, semester };
      })
      .sort((a, b) => {
        // Urutkan dari tahun ajaran terbaru ke terlama
        if (a.tahunAjaran > b.tahunAjaran) return -1;
        if (a.tahunAjaran < b.tahunAjaran) return 1;
        // Jika tahun sama, urutkan dari semester genap ke ganjil
        if (a.semester > b.semester) return -1;
        if (a.semester < b.semester) return 1;
        return 0;
      });

    res.json(formattedHistory);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil riwayat akademik.",
      error: error.message,
    });
  }
};
