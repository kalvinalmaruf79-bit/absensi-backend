// controllers/qrController.js - Fixed Version
const QRCode = require("qrcode");
const Jimp = require("jimp");
const path = require("path");
const SesiPresensi = require("../models/SesiPresensi");
const Jadwal = require("../models/Jadwal");

exports.generateQR = async (req, res) => {
  try {
    const { jadwalId, latitude, longitude } = req.body;

    // Validasi input
    if (!jadwalId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Jadwal ID dan lokasi wajib diisi.",
      });
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== "guru") {
      return res.status(403).json({
        message: "Akses ditolak: hanya guru yang dapat generate presensi.",
      });
    }

    // Validasi jadwal dan pastikan guru mengajar di jadwal ini
    const jadwal = await Jadwal.findOne({
      _id: jadwalId,
      guru: userId,
      isActive: true,
    }).populate("kelas mataPelajaran");

    if (!jadwal) {
      return res.status(404).json({
        message:
          "Jadwal tidak ditemukan atau Anda tidak mengajar di jadwal ini.",
      });
    }

    // Buat kode unik
    const kodeUnik = Math.random().toString(36).substring(2, 8).toUpperCase();
    const tanggalHariIni = new Date().toISOString().split("T")[0];

    // Cek apakah sudah ada sesi aktif untuk jadwal ini hari ini
    const existingSesi = await SesiPresensi.findOne({
      jadwal: jadwalId,
      tanggal: tanggalHariIni,
      isActive: true,
      expiredAt: { $gt: new Date() },
    });

    if (existingSesi) {
      return res.status(400).json({
        message: "Sesi presensi untuk jadwal ini masih aktif.",
      });
    }

    // Buat sesi presensi baru (berlaku 30 menit)
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 30);

    const sesiPresensi = new SesiPresensi({
      jadwal: jadwalId,
      kodeUnik,
      lokasi: { latitude, longitude },
      tanggal: tanggalHariIni,
      expiredAt,
      dibuatOleh: userId,
    });

    await sesiPresensi.save();

    // Data untuk QR Code
    const qrData = {
      KODE_SESI: kodeUnik,
      MATA_PELAJARAN: jadwal.mataPelajaran.nama,
      KELAS: jadwal.kelas.nama,
      TANGGAL: tanggalHariIni,
      EXPIRED: expiredAt.toISOString(),
    };

    // Generate QR Code dengan logo
    const qrBuffer = await QRCode.toBuffer(JSON.stringify(qrData), {
      errorCorrectionLevel: "H",
      width: 300,
    });

    const qrImage = await Jimp.read(qrBuffer);
    const logoPath = path.join(__dirname, "../public/logo-smk.png");
    const logo = await Jimp.read(logoPath);

    const logoSize = qrImage.bitmap.width / 5.5;
    logo.resize(logoSize, logoSize).circle();

    const x = (qrImage.bitmap.width - logoSize) / 2;
    const y = (qrImage.bitmap.height - logoSize) / 2;
    qrImage.composite(logo, x, y);

    const finalBuffer = await qrImage.getBufferAsync(Jimp.MIME_PNG);
    const qrImageData = `data:image/png;base64,${finalBuffer.toString(
      "base64"
    )}`;

    res.status(201).json({
      message: "QR Code berhasil dibuat.",
      qrCode: qrImageData,
      kodeUnik, // <-- Pastikan frontend Anda menangkap dan menampilkan kode ini
      expiredAt,
      jadwal: {
        mataPelajaran: jadwal.mataPelajaran.nama,
        kelas: jadwal.kelas.nama,
      },
    });
  } catch (error) {
    console.error("Error generating QR Code:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat membuat QR Code.",
      error: error.message,
    });
  }
};
