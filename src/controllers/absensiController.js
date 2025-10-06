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

exports.checkIn = async (req, res) => {
  try {
    const { kodeSesi, latitude, longitude } = req.body;
    const siswaId = req.user.id;

    if (!kodeSesi || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Kode sesi dan lokasi wajib diisi!",
      });
    }

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

    const tanggalHariIni = new Date().toISOString().split("T")[0];
    const existingAbsensi = await Absensi.findOne({
      siswa: siswaId,
      jadwal: sesiPresensi.jadwal._id,
      tanggal: tanggalHariIni,
    });

    // --- PERUBAHAN UTAMA: Validasi konflik absensi ---
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
    // --------------------------------------------------

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

    const absensi = new Absensi({
      siswa: siswaId,
      sesiPresensi: sesiPresensi._id,
      jadwal: sesiPresensi.jadwal._id,
      lokasiSiswa: { latitude, longitude },
      tanggal: tanggalHariIni,
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
      isManual: true, // Flag untuk manual entry
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
