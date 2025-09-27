// src/controllers/cronController.js
const Jadwal = require("../models/Jadwal");
const User = require("../models/User");
const Absensi = require("../models/Absensi");
const SesiPresensi = require("../models/SesiPresensi");
const Notifikasi = require("../models/Notifikasi");
const sendPushNotification = require("../utils/sendPushNotification");
const mongoose = require("mongoose");

// Helper untuk mengirim notifikasi massal
const sendBulkNotifications = async (
  users,
  notificationType,
  title,
  message
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
  }));

  if (notifikasiDocs.length > 0) {
    await Notifikasi.insertMany(notifikasiDocs);
  }

  // Kirim push notification
  if (playerIds.length > 0) {
    sendPushNotification(playerIds, title, message, {
      type: notificationType,
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
    const reminderTimeStart = new Date(now.getTime() + 9 * 60 * 1000); // 9 menit dari sekarang
    const reminderTimeEnd = new Date(now.getTime() + 11 * 60 * 1000); // 11 menit dari sekarang

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
    // Cek sesi yang seharusnya sudah berakhir 15 menit yang lalu
    const targetTime = new Date(now.getTime() - 15 * 60 * 1000);
    const tanggalHariIni = now.toISOString().split("T")[0];

    // 1. Cari sesi presensi yang dibuat hari ini dan sudah kedaluwarsa
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
      // 2. Dapatkan semua siswa di kelas tersebut
      const semuaSiswaDiKelas = await User.find({
        kelas: sesi.jadwal.kelas,
        role: "siswa",
        isActive: true,
      }).select("_id deviceTokens");
      const semuaSiswaIds = semuaSiswaDiKelas.map((s) => s._id.toString());

      // 3. Dapatkan siswa yang SUDAH absen di sesi ini
      const siswaSudahAbsen = await Absensi.find({
        sesiPresensi: sesi._id,
      }).select("siswa");
      const siswaSudahAbsenIds = siswaSudahAbsen.map((a) => a.siswa.toString());

      // 4. Tentukan siswa yang BELUM absen
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
