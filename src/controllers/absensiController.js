// controllers/absensiController.js
const SesiPresensi = require("../models/SesiPresensi");
const Absensi = require("../models/Absensi");
const Jadwal = require("../models/Jadwal");
const User = require("../models/User");
const ExcelJS = require("exceljs");

const MAX_RADIUS = 500;

const haversineDistance = (coords1, coords2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(coords2.latitude - coords1.latitude);
  const dLon = toRad(coords2.longitude - coords1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coords1.latitude)) *
      Math.cos(toRad(coords2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ========== CHECK-IN VIA QR CODE / TOKEN ==========
exports.checkIn = async (req, res) => {
  try {
    const { kodeSesi, latitude, longitude } = req.body;
    const siswaId = req.user.id;

    if (!kodeSesi || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Kode sesi dan lokasi wajib diisi!",
      });
    }

    // Cari sesi presensi berdasarkan kode unik
    const sesiPresensi = await SesiPresensi.findOne({
      kodeUnik: kodeSesi.toUpperCase(),
      isActive: true,
      expiredAt: { $gt: new Date() },
    }).populate("jadwal");

    if (!sesiPresensi) {
      return res.status(400).json({
        message: "Kode sesi tidak valid atau sudah kedaluwarsa!",
      });
    }

    // Validasi siswa terdaftar di kelas yang sesuai
    const siswa = await User.findById(siswaId);
    if (
      !siswa ||
      siswa.role !== "siswa" ||
      !siswa.kelas.equals(sesiPresensi.jadwal.kelas)
    ) {
      return res.status(403).json({
        message: "Anda tidak terdaftar di kelas yang sesuai dengan sesi ini.",
      });
    }

    // Cek presensi hari ini
    const tanggalHariIni = new Date().toISOString().split("T")[0];
    const existingAbsensi = await Absensi.findOne({
      siswa: siswaId,
      jadwal: sesiPresensi.jadwal._id,
      tanggal: tanggalHariIni,
    });

    // Validasi konflik absensi
    if (existingAbsensi) {
      if (
        existingAbsensi.keterangan === "izin" ||
        existingAbsensi.keterangan === "sakit"
      ) {
        return res.status(400).json({
          message: `Anda sudah tercatat '${existingAbsensi.keterangan}' untuk pelajaran ini. Tidak dapat melakukan presensi.`,
        });
      }
      return res.status(400).json({
        message:
          "Anda sudah melakukan presensi untuk mata pelajaran ini hari ini.",
      });
    }

    // Validasi jarak (hanya di production)
    const jarak = haversineDistance(
      { latitude, longitude },
      sesiPresensi.lokasi
    );

    if (process.env.NODE_ENV === "production" && jarak > MAX_RADIUS) {
      return res.status(403).json({
        message: `Anda berada di luar radius yang diizinkan! Jarak Anda ${jarak.toFixed(
          0
        )} meter.`,
      });
    }

    // Buat record absensi
    const absensi = new Absensi({
      siswa: siswaId,
      sesiPresensi: sesiPresensi._id,
      jadwal: sesiPresensi.jadwal._id,
      lokasiSiswa: { latitude, longitude },
      tanggal: tanggalHariIni,
      keterangan: "hadir",
    });

    await absensi.save();

    res.status(200).json({
      message: "Presensi berhasil!",
    });
  } catch (error) {
    console.error("Error during check-in:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat proses check-in." });
  }
};

// ========== CHECK-IN VIA MANUAL CODE (Untuk siswa tanpa support QR) ==========
exports.checkInWithCode = async (req, res) => {
  try {
    const { kodeAbsen } = req.body;
    const siswaId = req.user.id;

    if (!kodeAbsen) {
      return res.status(400).json({
        message: "Kode absen wajib diisi!",
      });
    }

    // Cari sesi presensi berdasarkan kode unik (sama seperti QR code)
    const sesiPresensi = await SesiPresensi.findOne({
      kodeUnik: kodeAbsen.toUpperCase(),
      isActive: true,
      expiredAt: { $gt: new Date() },
    }).populate("jadwal");

    if (!sesiPresensi) {
      return res.status(400).json({
        message: "Kode absen tidak valid atau sudah kedaluwarsa!",
      });
    }

    // Validasi siswa terdaftar di kelas yang sesuai
    const siswa = await User.findById(siswaId);
    if (
      !siswa ||
      siswa.role !== "siswa" ||
      !siswa.kelas.equals(sesiPresensi.jadwal.kelas)
    ) {
      return res.status(403).json({
        message: "Anda tidak terdaftar di kelas yang sesuai dengan sesi ini.",
      });
    }

    // Cek presensi hari ini
    const tanggalHariIni = new Date().toISOString().split("T")[0];
    const existingAbsensi = await Absensi.findOne({
      siswa: siswaId,
      jadwal: sesiPresensi.jadwal._id,
      tanggal: tanggalHariIni,
    });

    // Validasi konflik absensi
    if (existingAbsensi) {
      if (
        existingAbsensi.keterangan === "izin" ||
        existingAbsensi.keterangan === "sakit"
      ) {
        return res.status(400).json({
          message: `Anda sudah tercatat '${existingAbsensi.keterangan}' untuk pelajaran ini. Tidak dapat melakukan presensi.`,
        });
      }
      return res.status(400).json({
        message:
          "Anda sudah melakukan presensi untuk mata pelajaran ini hari ini.",
      });
    }

    // Buat record absensi (TANPA lokasi, karena tidak ada GPS)
    const absensi = new Absensi({
      siswa: siswaId,
      sesiPresensi: sesiPresensi._id,
      jadwal: sesiPresensi.jadwal._id,
      tanggal: tanggalHariIni,
      keterangan: "hadir",
      // lokasiSiswa tidak diisi karena siswa tidak scan QR
    });

    await absensi.save();

    res.status(200).json({
      message: "Presensi berhasil!",
    });
  } catch (error) {
    console.error("Error during check-in with code:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat proses check-in." });
  }
};

// ========== GET RIWAYAT ABSENSI ==========
exports.getRiwayatAbsensi = async (req, res) => {
  try {
    const { tanggal, kelasId, mataPelajaranId } = req.query;
    const guruId = req.user.id;

    let filter = {};

    if (tanggal) {
      filter.tanggal = tanggal;
    }

    const jadwalGuru = await Jadwal.find({
      guru: guruId,
      isActive: true,
      ...(kelasId && { kelas: kelasId }),
      ...(mataPelajaranId && { mataPelajaran: mataPelajaranId }),
    }).select("_id");

    filter.jadwal = { $in: jadwalGuru.map((j) => j._id) };

    const absensi = await Absensi.find(filter)
      .populate("siswa", "name identifier")
      .populate({
        path: "jadwal",
        populate: [
          { path: "kelas", select: "nama" },
          { path: "mataPelajaran", select: "nama" },
        ],
      })
      .sort({ waktuMasuk: -1 });

    const formatted = absensi.map((item) => ({
      _id: item._id,
      nama: item.siswa?.name || "Tidak diketahui",
      nisn: item.siswa?.identifier || "-",
      kelas: item.jadwal?.kelas?.nama || "-",
      mataPelajaran: item.jadwal?.mataPelajaran?.nama || "-",
      waktuMasuk: item.waktuMasuk,
      keterangan: item.keterangan,
      tanggal: item.tanggal,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error getting absensi:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ========== UPDATE KETERANGAN PRESENSI ==========
exports.updateKeteranganPresensi = async (req, res) => {
  try {
    const { id } = req.params;
    const { keterangan } = req.body;

    if (!["hadir", "izin", "sakit", "alpa"].includes(keterangan)) {
      return res.status(400).json({
        message:
          "Keterangan tidak valid. Pilih: hadir, izin, sakit, atau alpa.",
      });
    }

    const absensi = await Absensi.findByIdAndUpdate(
      id,
      { keterangan },
      { new: true }
    ).populate("siswa", "name identifier");

    if (!absensi) {
      return res.status(404).json({
        message: "Data presensi tidak ditemukan.",
      });
    }

    res.json({
      message: "Keterangan berhasil diperbarui",
      data: absensi,
    });
  } catch (error) {
    console.error("Error updating keterangan:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// ========== EXPORT ABSENSI KE EXCEL ==========
exports.exportAbsensi = async (req, res) => {
  try {
    const { tanggal, kelasId, mataPelajaranId } = req.query;
    const guruId = req.user.id;

    let filter = {};
    if (tanggal) {
      filter.tanggal = tanggal;
    }

    const jadwalGuru = await Jadwal.find({
      guru: guruId,
      isActive: true,
      ...(kelasId && { kelas: kelasId }),
      ...(mataPelajaranId && { mataPelajaran: mataPelajaranId }),
    }).select("_id");

    filter.jadwal = { $in: jadwalGuru.map((j) => j._id) };

    const absensi = await Absensi.find(filter)
      .populate("siswa", "name identifier")
      .populate({
        path: "jadwal",
        populate: [
          { path: "kelas", select: "nama" },
          { path: "mataPelajaran", select: "nama" },
        ],
      })
      .sort({ waktuMasuk: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Riwayat Presensi");

    worksheet.columns = [
      { header: "Tanggal", key: "tanggal", width: 15 },
      { header: "Nama Siswa", key: "nama", width: 25 },
      { header: "NIS", key: "nisn", width: 20 },
      { header: "Kelas", key: "kelas", width: 20 },
      { header: "Mata Pelajaran", key: "mataPelajaran", width: 20 },
      { header: "Waktu Masuk", key: "waktuMasuk", width: 25 },
      { header: "Keterangan", key: "keterangan", width: 15 },
    ];

    absensi.forEach((item) => {
      worksheet.addRow({
        tanggal: item.tanggal,
        nama: item.siswa?.name || "Tidak diketahui",
        nisn: item.siswa?.identifier || "-",
        kelas: item.jadwal?.kelas?.nama || "-",
        mataPelajaran: item.jadwal?.mataPelajaran?.nama || "-",
        waktuMasuk: item.waktuMasuk
          ? new Date(item.waktuMasuk).toLocaleString("id-ID")
          : "-",
        keterangan: item.keterangan || "hadir",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=riwayat-presensi.xlsx"
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error exporting Excel:", error);
    res.status(500).json({ message: "Gagal ekspor data ke Excel." });
  }
};

// ========== CREATE MANUAL ABSENSI (Guru/Admin) ==========
exports.createManualAbsensi = async (req, res) => {
  try {
    const { siswaId, jadwalId, keterangan, tanggal } = req.body;

    if (!siswaId || !jadwalId || !keterangan || !tanggal) {
      return res.status(400).json({
        message: "Semua field wajib diisi.",
      });
    }

    // Validasi guru mengajar di jadwal ini
    const jadwal = await Jadwal.findOne({
      _id: jadwalId,
      guru: req.user.id,
      isActive: true,
    });

    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak memiliki akses untuk jadwal ini.",
      });
    }

    // Cek apakah sudah ada record
    const existing = await Absensi.findOne({
      siswa: siswaId,
      jadwal: jadwalId,
      tanggal: tanggal,
    });

    if (existing) {
      return res.status(400).json({
        message: "Record absensi sudah ada untuk siswa ini.",
      });
    }

    // Buat record absensi manual
    const absensi = new Absensi({
      siswa: siswaId,
      jadwal: jadwalId,
      tanggal: tanggal,
      keterangan: keterangan,
      isManual: true,
    });

    await absensi.save();

    res.status(201).json({
      message: "Absensi manual berhasil ditambahkan.",
      data: absensi,
    });
  } catch (error) {
    console.error("Error create manual absensi:", error);
    res.status(500).json({
      message: "Gagal menambahkan absensi manual.",
    });
  }
};
