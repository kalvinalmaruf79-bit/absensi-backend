// controllers/qrController.js - Fixed Timezone Version
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

    // --- VALIDASI WAKTU DAN HARI PEMBUATAN SESI (FIXED TIMEZONE) ---

    // Konversi ke WIB (UTC+7)
    const nowUTC = new Date();
    const WIB_OFFSET = 7 * 60; // 7 jam dalam menit
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET * 60 * 1000);

    // Array hari dalam bahasa Indonesia
    const hariArray = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ];
    const hariIni = hariArray[nowWIB.getUTCDay()];

    console.log("DEBUG Timezone:");
    console.log("- UTC Time:", nowUTC.toISOString());
    console.log("- WIB Time:", nowWIB.toISOString());
    console.log("- Hari ini:", hariIni);
    console.log("- Jadwal hari:", jadwal.hari);

    // 1. Cek apakah hari ini sesuai dengan jadwal
    if (jadwal.hari !== hariIni) {
      return res.status(403).json({
        message: `Jadwal ini hanya untuk hari ${jadwal.hari}. Hari ini adalah ${hariIni}.`,
      });
    }

    // 2. Cek apakah waktu saat ini berada dalam rentang jam pelajaran
    const [startHour, startMinute] = jadwal.jamMulai.split(":").map(Number);
    const [endHour, endMinute] = jadwal.jamSelesai.split(":").map(Number);

    // Buat waktu mulai dan selesai dalam WIB
    const startTime = new Date(nowWIB);
    startTime.setUTCHours(startHour, startMinute, 0, 0);

    const endTime = new Date(nowWIB);
    endTime.setUTCHours(endHour, endMinute, 0, 0);

    console.log("DEBUG Jam:");
    console.log(
      "- Jam Mulai:",
      startTime.toISOString(),
      `(${jadwal.jamMulai})`
    );
    console.log("- Jam Sekarang:", nowWIB.toISOString());
    console.log(
      "- Jam Selesai:",
      endTime.toISOString(),
      `(${jadwal.jamSelesai})`
    );

    if (nowWIB < startTime || nowWIB > endTime) {
      return res.status(403).json({
        message: `Sesi presensi hanya dapat dibuat selama jam pelajaran berlangsung (${
          jadwal.jamMulai
        } - ${jadwal.jamSelesai} WIB). Sekarang: ${nowWIB
          .getUTCHours()
          .toString()
          .padStart(2, "0")}:${nowWIB
          .getUTCMinutes()
          .toString()
          .padStart(2, "0")} WIB`,
      });
    }
    // --- AKHIR DARI VALIDASI WAKTU ---

    const kodeUnik = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Format tanggal dalam WIB
    const year = nowWIB.getUTCFullYear();
    const month = String(nowWIB.getUTCMonth() + 1).padStart(2, "0");
    const day = String(nowWIB.getUTCDate()).padStart(2, "0");
    const tanggalHariIni = `${year}-${month}-${day}`;

    console.log("- Tanggal (WIB):", tanggalHariIni);

    // Cek apakah sudah ada sesi aktif untuk jadwal ini hari ini
    const existingSesi = await SesiPresensi.findOne({
      jadwal: jadwalId,
      tanggal: tanggalHariIni,
      isActive: true,
      expiredAt: { $gt: nowUTC }, // Bandingkan dengan UTC untuk database
    });

    // Jika sesi sudah ada, kembalikan data sesi tersebut
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
        isExisting: true,
        sesiId: existingSesi._id,
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
    const expiredAt = new Date(nowUTC);
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

    console.log("✅ Sesi presensi berhasil dibuat!");

    res.status(201).json({
      message: "QR Code berhasil dibuat.",
      isExisting: false,
      sesiId: sesiPresensi._id,
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

// Endpoint untuk cek sesi aktif
exports.checkActiveSessions = async (req, res) => {
  try {
    const guruId = req.user.id;

    // Konversi ke WIB untuk mendapatkan tanggal yang benar
    const nowUTC = new Date();
    const WIB_OFFSET = 7 * 60;
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET * 60 * 1000);

    const year = nowWIB.getUTCFullYear();
    const month = String(nowWIB.getUTCMonth() + 1).padStart(2, "0");
    const day = String(nowWIB.getUTCDate()).padStart(2, "0");
    const tanggalHariIni = `${year}-${month}-${day}`;

    const sesiAktif = await SesiPresensi.find({
      dibuatOleh: guruId,
      tanggal: tanggalHariIni,
      isActive: true,
      expiredAt: { $gt: nowUTC },
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

// Endpoint untuk mengakhiri sesi presensi
exports.endSession = async (req, res) => {
  try {
    const { sesiId } = req.params;
    const guruId = req.user.id;

    // Cari sesi yang aktif
    const sesiPresensi = await SesiPresensi.findOne({
      _id: sesiId,
      dibuatOleh: guruId,
      isActive: true,
    }).populate({
      path: "jadwal",
      populate: [
        { path: "kelas", select: "nama" },
        { path: "mataPelajaran", select: "nama" },
      ],
    });

    if (!sesiPresensi) {
      return res.status(404).json({
        message: "Sesi presensi tidak ditemukan atau sudah diakhiri.",
      });
    }

    // Update sesi menjadi tidak aktif
    sesiPresensi.isActive = false;
    sesiPresensi.expiredAt = new Date(); // Set expired ke waktu sekarang
    await sesiPresensi.save();

    res.status(200).json({
      message: "Sesi presensi berhasil diakhiri.",
      data: {
        sesiId: sesiPresensi._id,
        kelas: sesiPresensi.jadwal.kelas.nama,
        mataPelajaran: sesiPresensi.jadwal.mataPelajaran.nama,
        tanggal: sesiPresensi.tanggal,
      },
    });
  } catch (error) {
    console.error("Error ending session:", error);
    res.status(500).json({
      message: "Gagal mengakhiri sesi presensi.",
      error: error.message,
    });
  }
};

// Endpoint untuk mengakhiri semua sesi aktif guru (opsional)
exports.endAllActiveSessions = async (req, res) => {
  try {
    const guruId = req.user.id;

    const nowUTC = new Date();
    const WIB_OFFSET = 7 * 60;
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET * 60 * 1000);

    const year = nowWIB.getUTCFullYear();
    const month = String(nowWIB.getUTCMonth() + 1).padStart(2, "0");
    const day = String(nowWIB.getUTCDate()).padStart(2, "0");
    const tanggalHariIni = `${year}-${month}-${day}`;

    // Update semua sesi aktif guru hari ini
    const result = await SesiPresensi.updateMany(
      {
        dibuatOleh: guruId,
        tanggal: tanggalHariIni,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
          expiredAt: nowUTC,
        },
      }
    );

    res.status(200).json({
      message: `${result.modifiedCount} sesi presensi berhasil diakhiri.`,
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error ending all sessions:", error);
    res.status(500).json({
      message: "Gagal mengakhiri sesi presensi.",
      error: error.message,
    });
  }
};
