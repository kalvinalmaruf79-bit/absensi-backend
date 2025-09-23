const Laporan = require("../models/Laporan"); // Import model Laporan dari folder models
const path = require("path"); // Module bawaan Node.js untuk manipulasi path
const fs = require("fs"); // Module filesystem untuk mengelola file

// Upload Laporan
exports.uploadLaporan = async (req, res) => {
  try {
    console.log("🧾 File?:", req.file); // Log file yang diupload
    console.log("🧾 Body?:", req.body); // Log body (deskripsi dan kategori)

    if (!req.file) {
      return res
        .status(400)
        .json({ message: "❌ Tidak ada file yang dikirim." }); // Validasi file tidak ada
    }

    const { deskripsi, kategori } = req.body;
    if (!deskripsi || deskripsi.trim() === "") {
      fs.unlinkSync(req.file.path); // Hapus file dari server jika deskripsi kosong
      return res
        .status(400)
        .json({ message: "❌ Deskripsi laporan wajib diisi." }); // Validasi deskripsi
    }

    let userRole;
    switch (req.user.role) {
      case "siswa":
        userRole = "Siswa";
        break;
      case "guru":
        userRole = "Guru";
        break;
      case "super_admin":
        userRole = "SuperAdmin";
        break;
    }

    const laporan = new Laporan({
      user: req.user.id, // Ambil user ID dari token
      userRole: userRole,
      filePath: req.file.path, // Path file tersimpan di server
      fileName: req.file.originalname, // Nama file asli
      deskripsi: deskripsi.trim(), // Deskripsi laporan
      kategori: kategori || "lainnya", // Kategori default jika tidak ada
    });

    await laporan.save(); // Simpan laporan ke database
    return res.status(201).json({ message: "✅ Laporan berhasil diupload" }); // Respon sukses
  } catch (err) {
    console.error("❌ Upload Error:", err.message); // Log error jika upload gagal

    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // Hapus file jika error terjadi
    }

    res
      .status(500)
      .json({ message: "❌ Gagal upload laporan", error: err.message }); // Respon error
  }
};

// Get Semua Laporan (dengan filter opsional tanggal)
exports.getSemuaLaporan = async (req, res) => {
  try {
    const { tanggal } = req.query; // Ambil query tanggal (opsional)

    let filter = {};
    if (tanggal) {
      const start = new Date(tanggal); // Tanggal awal
      const end = new Date(tanggal); // Tanggal akhir (hari berikutnya)
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end }; // Filter berdasarkan createdAt
    }

    const laporan = await Laporan.find(filter).populate("user", "name email"); // Ambil laporan + info user
    res.status(200).json(laporan); // Kirim data laporan
  } catch (err) {
    console.error("❌ Error ambil laporan:", err.message); // Log error
    res
      .status(500)
      .json({ message: "❌ Gagal mengambil data laporan", error: err.message }); // Respon error
  }
};

// Download Laporan
exports.downloadLaporan = async (req, res) => {
  try {
    const laporan = await Laporan.findById(req.params.id); // Cari laporan berdasarkan ID
    if (!laporan)
      return res.status(404).json({ message: "❌ File tidak ditemukan" }); // Jika tidak ditemukan

    const filePath = path.resolve(laporan.filePath); // Resolusi path absolut ke file
    if (!fs.existsSync(filePath))
      return res
        .status(404)
        .json({ message: "❌ File tidak tersedia di server." }); // File tidak ada

    res.download(filePath, laporan.fileName); // Unduh file ke klien
  } catch (err) {
    console.error("❌ Download Error:", err.message); // Log error
    res
      .status(500)
      .json({ message: "❌ Gagal download file", error: err.message }); // Respon error
  }
};
