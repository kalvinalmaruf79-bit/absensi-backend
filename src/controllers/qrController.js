// controllers/qrController.js - Fixed Version
const QRCode = require("qrcode");
const Jimp = require("jimp");
const path = require("path");
const SesiPresensi = require("../models/SesiPresensi");
const Jadwal = require("../models/Jadwal");

exports.generateQR = async (req, res) => {
  try {
    const { jadwalId, latitude, longitude } = req.body;

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

    // --- VALIDASI WAKTU DAN HARI PEMBUATAN SESI ---
    const now = new Date();
    const hariIni = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ][now.getDay()];

    // 1. Cek apakah hari ini sesuai dengan jadwal
    if (jadwal.hari !== hariIni) {
      return res.status(403).json({
        message: `Jadwal ini hanya untuk hari ${jadwal.hari}. Anda tidak dapat membuat sesi hari ini.`,
      });
    }

    // 2. Cek apakah waktu saat ini berada dalam rentang jam pelajaran
    const [startHour, startMinute] = jadwal.jamMulai.split(":").map(Number);
    const [endHour, endMinute] = jadwal.jamSelesai.split(":").map(Number);

    const startTime = new Date(now);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(now);
    endTime.setHours(endHour, endMinute, 0, 0);

    if (now < startTime || now > endTime) {
      return res.status(403).json({
        message: `Sesi presensi hanya dapat dibuat selama jam pelajaran berlangsung (${jadwal.jamMulai} - ${jadwal.jamSelesai}).`,
      });
    }
    // --- AKHIR DARI VALIDASI WAKTU ---

    const kodeUnik = Math.random().toString(36).substring(2, 8).toUpperCase();
    const tanggalHariIni = new Date().toISOString().split("T")[0];

    // Cek apakah sudah ada sesi aktif untuk jadwal ini hari ini
    const existingSesi = await SesiPresensi.findOne({
      jadwal: jadwalId,
      tanggal: tanggalHariIni,
      isActive: true,
      expiredAt: { $gt: new Date() },
    });

    // PERUBAHAN UTAMA: Jika sesi sudah ada, kembalikan data sesi tersebut
    if (existingSesi) {
      // Generate QR Code dari sesi yang sudah ada
      const qrData = {
        KODE_SESI: existingSesi.kodeUnik,
        MATA_PELAJARAN: jadwal.mataPelajaran.nama,
        KELAS: jadwal.kelas.nama,
        TANGGAL: tanggalHariIni,
        EXPIRED: existingSesi.expiredAt.toISOString(),
      };

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

      return res.status(200).json({
        message: "Sesi presensi sudah aktif.",
        isExisting: true, // Flag untuk frontend
        qrCode: qrImageData,
        kodeUnik: existingSesi.kodeUnik,
        expiredAt: existingSesi.expiredAt,
        jadwal: {
          mataPelajaran: jadwal.mataPelajaran.nama,
          kelas: jadwal.kelas.nama,
        },
      });
    }

    // Buat sesi presensi baru jika belum ada
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

    const qrData = {
      KODE_SESI: kodeUnik,
      MATA_PELAJARAN: jadwal.mataPelajaran.nama,
      KELAS: jadwal.kelas.nama,
      TANGGAL: tanggalHariIni,
      EXPIRED: expiredAt.toISOString(),
    };

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
      isExisting: false,
      qrCode: qrImageData,
      kodeUnik,
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

// TAMBAHAN: Endpoint untuk cek sesi aktif
exports.checkActiveSessions = async (req, res) => {
  try {
    const guruId = req.user.id;
    const tanggalHariIni = new Date().toISOString().split("T")[0];

    const sesiAktif = await SesiPresensi.find({
      dibuatOleh: guruId,
      tanggal: tanggalHariIni,
      isActive: true,
      expiredAt: { $gt: new Date() },
    }).populate({
      path: "jadwal",
      populate: [
        { path: "kelas", select: "nama" },
        { path: "mataPelajaran", select: "nama" },
      ],
    });

    res.json(sesiAktif);
  } catch (error) {
    console.error("Error checking active sessions:", error);
    res.status(500).json({
      message: "Gagal mengecek sesi aktif.",
      error: error.message,
    });
  }
};
