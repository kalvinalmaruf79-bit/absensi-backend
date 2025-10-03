// src/controllers/cronController.js
const Jadwal = require("../models/Jadwal");
const User = require("../models/User");
const Absensi = require("../models/Absensi");
const SesiPresensi = require("../models/SesiPresensi");
const Notifikasi = require("../models/Notifikasi");
const Nilai = require("../models/Nilai"); // <-- 1. Impor model Nilai
const Tugas = require("../models/Tugas"); // <-- 2. Impor model Tugas
const sendPushNotification = require("../utils/sendPushNotification");
const mongoose = require("mongoose");

// Helper untuk mengirim notifikasi massal
const sendBulkNotifications = async (
  users,
  notificationType,
  title,
  message,
  resourceId = null
) => {
  if (!users || users.length === 0) return;

  const userIds = users.map((u) => u._id);
  const playerIds = users.flatMap((u) => u.deviceTokens);

  // Buat entri notifikasi di database
  const notifikasiDocs = userIds.map((userId) => ({
    penerima: userId,
    tipe: notificationType,
    judul: title,
    pesan: message,
    ...(resourceId && { resourceId }),
  }));

  if (notifikasiDocs.length > 0) {
    await Notifikasi.insertMany(notifikasiDocs);
  }

  // Kirim push notification
  if (playerIds.length > 0) {
    sendPushNotification(playerIds, title, message, {
      type: notificationType,
      ...(resourceId && { resourceId: resourceId.toString() }),
    });
  }
};

/**
 * @summary Mengirim pengingat presensi 10 menit sebelum kelas dimulai.
 * @description Dijalankan setiap 5 menit oleh Vercel Cron Job.
 */
exports.sendPresenceReminders = async (req, res) => {
  try {
    const now = new Date();
    const reminderTimeStart = new Date(now.getTime() + 9 * 60 * 1000);
    const reminderTimeEnd = new Date(now.getTime() + 11 * 60 * 1000);

    const jamMulai = `${reminderTimeStart
      .getHours()
      .toString()
      .padStart(2, "0")}:${reminderTimeStart
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const hariIni = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ][now.getDay()];

    const jadwalAkanDatang = await Jadwal.find({
      hari: hariIni,
      jamMulai: jamMulai,
      isActive: true,
    }).populate("mataPelajaran", "nama");

    if (jadwalAkanDatang.length === 0) {
      return res.json({
        message: "Tidak ada jadwal untuk diingatkan saat ini.",
      });
    }

    for (const jadwal of jadwalAkanDatang) {
      const siswaDiKelas = await User.find({
        kelas: jadwal.kelas,
        role: "siswa",
        isActive: true,
      }).select("_id deviceTokens");

      await sendBulkNotifications(
        siswaDiKelas,
        "pengingat_presensi",
        `Kelas Akan Dimulai`,
        `Kelas ${jadwal.mataPelajaran.nama} akan dimulai dalam 10 menit. Jangan lupa presensi!`
      );
    }

    res.json({
      message: `Pengingat terkirim untuk ${jadwalAkanDatang.length} jadwal.`,
    });
  } catch (error) {
    console.error("Cron Job Error (sendPresenceReminders):", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * @summary Memberi notifikasi siswa yang belum presensi setelah sesi berakhir.
 * @description Dijalankan setiap 15 menit oleh Vercel Cron Job.
 */
exports.notifyLateStudents = async (req, res) => {
  try {
    const now = new Date();
    const targetTime = new Date(now.getTime() - 15 * 60 * 1000);
    const tanggalHariIni = now.toISOString().split("T")[0];

    const expiredSessions = await SesiPresensi.find({
      tanggal: tanggalHariIni,
      expiredAt: { $lte: targetTime },
    }).populate({
      path: "jadwal",
      populate: { path: "mataPelajaran", select: "nama" },
    });

    if (expiredSessions.length === 0) {
      return res.json({
        message: "Tidak ada sesi kedaluwarsa untuk diperiksa.",
      });
    }

    let totalNotified = 0;
    for (const sesi of expiredSessions) {
      const semuaSiswaDiKelas = await User.find({
        kelas: sesi.jadwal.kelas,
        role: "siswa",
        isActive: true,
      }).select("_id deviceTokens");
      const semuaSiswaIds = semuaSiswaDiKelas.map((s) => s._id.toString());

      const siswaSudahAbsen = await Absensi.find({
        sesiPresensi: sesi._id,
      }).select("siswa");
      const siswaSudahAbsenIds = siswaSudahAbsen.map((a) => a.siswa.toString());

      const siswaBelumAbsen = semuaSiswaDiKelas.filter(
        (siswa) => !siswaSudahAbsenIds.includes(siswa._id.toString())
      );

      if (siswaBelumAbsen.length > 0) {
        await sendBulkNotifications(
          siswaBelumAbsen,
          "presensi_alpa",
          `Anda Belum Presensi`,
          `Anda tercatat alpa pada mata pelajaran ${sesi.jadwal.mataPelajaran.nama}. Hubungi guru jika ini adalah kesalahan.`
        );
        totalNotified += siswaBelumAbsen.length;
      }
    }

    res.json({
      message: `Pemeriksaan selesai. ${totalNotified} notifikasi keterlambatan terkirim.`,
    });
  } catch (error) {
    console.error("Cron Job Error (notifyLateStudents):", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// <-- 3. FUNGSI BARU UNTUK LAPORAN MINGGUAN
/**
 * @summary Mengirim laporan performa mingguan ke setiap siswa.
 * @description Dijalankan setiap Sabtu malam oleh Vercel Cron Job.
 */
exports.sendWeeklyReports = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeStudents = await User.find({
      role: "siswa",
      isActive: true,
      deviceTokens: { $exists: true, $ne: [] }, // Hanya siswa dengan device token
    }).select("_id kelas deviceTokens");

    if (activeStudents.length === 0) {
      return res.json({
        message: "Tidak ada siswa aktif untuk dikirimi laporan.",
      });
    }

    let totalReportsSent = 0;
    for (const siswa of activeStudents) {
      const [absensiRekap, nilaiBaruCount, tugasMendatangCount] =
        await Promise.all([
          // Rekap absensi
          Absensi.aggregate([
            {
              $match: {
                siswa: siswa._id,
                createdAt: { $gte: sevenDaysAgo, $lte: now },
              },
            },
            { $group: { _id: "$keterangan", count: { $sum: 1 } } },
          ]),
          // Jumlah nilai baru
          Nilai.countDocuments({
            siswa: siswa._id,
            createdAt: { $gte: sevenDaysAgo, $lte: now },
          }),
          // Jumlah tugas mendatang
          Tugas.countDocuments({
            kelas: siswa.kelas,
            deadline: { $gt: now },
          }),
        ]);

      let rekapAbsensiString = "Kehadiran: ";
      if (absensiRekap.length > 0) {
        rekapAbsensiString += absensiRekap
          .map((item) => `${item._id} (${item.count})`)
          .join(", ");
      } else {
        rekapAbsensiString += "Tidak ada data.";
      }

      const message = `Aktivitasmu minggu ini: ${rekapAbsensiString}. Anda mendapatkan ${nilaiBaruCount} nilai baru dan ada ${tugasMendatangCount} tugas menanti. Tetap semangat!`;

      // Kirim notifikasi ke satu siswa
      sendPushNotification(
        siswa.deviceTokens,
        "Laporan Aktivitas Mingguan",
        message,
        { type: "laporan_mingguan" } // Data tambahan untuk navigasi
      );

      // Simpan juga di database notifikasi
      await Notifikasi.create({
        penerima: siswa._id,
        tipe: "pengumuman_baru", // Bisa disesuaikan jika ingin tipe baru
        judul: "Laporan Aktivitas Mingguan",
        pesan: message,
      });

      totalReportsSent++;
    }

    res.json({
      message: `Laporan mingguan berhasil dikirim ke ${totalReportsSent} siswa.`,
    });
  } catch (error) {
    console.error("Cron Job Error (sendWeeklyReports):", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
