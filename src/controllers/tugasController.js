// src/controllers/tugasController.js
const Tugas = require("../models/Tugas");
const Nilai = require("../models/Nilai");
const User = require("../models/User");
const Notifikasi = require("../models/Notifikasi");
const sendPushNotification = require("../utils/sendPushNotification"); // Impor utility baru
const mongoose = require("mongoose");
const fs = require("fs");

// Helper untuk membuat notifikasi di database
const createBulkNotifikasi = async (
  penerimaIds,
  tipe,
  judul,
  pesan,
  resourceId
) => {
  const notifikasi = penerimaIds.map((penerima) => ({
    penerima,
    tipe,
    judul,
    pesan,
    resourceId,
  }));
  if (notifikasi.length > 0) {
    await Notifikasi.insertMany(notifikasi);
  }
};

// Guru: Membuat tugas baru
exports.createTugas = async (req, res) => {
  try {
    const {
      judul,
      deskripsi,
      mataPelajaran,
      kelas,
      deadline,
      semester,
      tahunAjaran,
    } = req.body;

    if (!semester || !tahunAjaran) {
      return res
        .status(400)
        .json({ message: "Semester dan Tahun Ajaran wajib diisi." });
    }

    const tugas = new Tugas({
      judul,
      deskripsi,
      mataPelajaran,
      kelas,
      deadline,
      semester,
      tahunAjaran,
      guru: req.user.id,
    });
    await tugas.save();

    // Ambil data siswa beserta deviceTokens
    const siswaDiKelas = await User.find({
      kelas: kelas,
      role: "siswa",
    }).select("_id deviceTokens");

    const siswaIds = siswaDiKelas.map((s) => s._id);
    const playerIds = siswaDiKelas.flatMap((s) => s.deviceTokens);

    // Kirim notifikasi ke database (untuk riwayat)
    await createBulkNotifikasi(
      siswaIds,
      "tugas_baru",
      `Tugas Baru: ${judul}`,
      "Sebuah tugas baru telah ditambahkan.",
      tugas._id
    );

    // KIRIM PUSH NOTIFICATION (FIRE-AND-FORGET)
    sendPushNotification(
      playerIds,
      `Tugas Baru: ${judul}`,
      "Cek tugas baru di aplikasi sekarang!",
      {
        type: "tugas_baru",
        resourceId: tugas._id.toString(),
      }
    );

    res.status(201).json({ message: "Tugas berhasil dibuat.", tugas });
  } catch (error) {
    res.status(500).json({ message: "Gagal membuat tugas." });
  }
};

// Siswa & Guru: Mendapatkan tugas berdasarkan kelas dan mapel
exports.getTugasByKelas = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId } = req.query;
    const tugas = await Tugas.find({
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    }).sort({ deadline: 1 });
    res.json(tugas);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil tugas." });
  }
};

// Siswa: Mengumpulkan tugas
exports.submitTugas = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: "File tugas wajib diunggah." });
    }

    const submission = {
      _id: new mongoose.Types.ObjectId(),
      siswa: req.user.id,
      filePath: req.file.path,
      fileName: req.file.originalname,
    };

    const tugas = await Tugas.findOneAndUpdate(
      { _id: id, "submissions.siswa": { $ne: req.user.id } },
      { $push: { submissions: submission } },
      { new: true }
    );

    if (!tugas) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message:
          "Gagal mengumpulkan tugas. Anda mungkin sudah pernah mengumpulkan.",
      });
    }

    res.json({ message: "Tugas berhasil dikumpulkan." });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengumpulkan tugas." });
  }
};

// Guru: Melihat semua pengumpulan untuk satu tugas
exports.getTugasSubmissions = async (req, res) => {
  try {
    const { tugasId } = req.params;
    const tugas = await Tugas.findById(tugasId).populate(
      "submissions.siswa",
      "name identifier"
    );

    if (!tugas) {
      return res.status(404).json({ message: "Tugas tidak ditemukan." });
    }
    if (tugas.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak memiliki akses ke tugas ini." });
    }

    res.json(tugas.submissions);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data submission." });
  }
};

// Guru: Memberikan nilai dan feedback
exports.gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { nilai, feedback } = req.body;

    if (nilai === undefined) {
      return res.status(400).json({ message: "Nilai wajib diisi." });
    }

    const tugas = await Tugas.findOne({
      "submissions._id": submissionId,
      guru: req.user.id,
    });

    if (!tugas) {
      return res.status(404).json({
        message: "Submission tidak ditemukan atau Anda tidak berhak menilai.",
      });
    }

    const submission = tugas.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission tidak ditemukan." });
    }

    submission.nilai = nilai;
    submission.feedback = feedback;
    await tugas.save();

    const nilaiRecord = await Nilai.findOneAndUpdate(
      {
        siswa: submission.siswa,
        mataPelajaran: tugas.mataPelajaran,
        jenisPenilaian: "tugas",
        deskripsi: `Tugas: ${tugas.judul}`,
        semester: tugas.semester,
        tahunAjaran: tugas.tahunAjaran,
      },
      {
        $set: {
          nilai: nilai,
          guru: req.user.id,
          kelas: tugas.kelas,
        },
      },
      { upsert: true, new: true }
    );

    // Buat notifikasi di database
    const notif = new Notifikasi({
      penerima: submission.siswa,
      tipe: "nilai_baru",
      judul: `Nilai Tugas: ${tugas.judul}`,
      pesan: `Anda mendapatkan nilai ${nilai} untuk tugas ini.`,
      resourceId: nilaiRecord._id,
    });
    await notif.save();

    // KIRIM PUSH NOTIFICATION
    const siswa = await User.findById(submission.siswa).select("deviceTokens");
    if (siswa && siswa.deviceTokens) {
      sendPushNotification(
        siswa.deviceTokens,
        `Nilai Tugas: ${tugas.judul}`,
        `Anda mendapatkan nilai ${nilai}. Lihat detailnya di aplikasi.`,
        { type: "nilai_baru", resourceId: nilaiRecord._id.toString() }
      );
    }

    res.json({ message: "Nilai berhasil disimpan dan disentralisasi." });
  } catch (error) {
    console.error("Error grading submission:", error);
    res.status(500).json({ message: "Gagal menyimpan nilai." });
  }
};
