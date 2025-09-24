// src/controllers/tugasController.js
const Tugas = require("../models/Tugas");
const Nilai = require("../models/Nilai"); // Tambahkan ini
const mongoose = require("mongoose");
const fs = require("fs");

// Guru: Membuat tugas baru
exports.createTugas = async (req, res) => {
  try {
    const { judul, deskripsi, mataPelajaran, kelas, deadline } = req.body;
    const tugas = new Tugas({
      judul,
      deskripsi,
      mataPelajaran,
      kelas,
      deadline,
      guru: req.user.id,
    });
    await tugas.save();
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
      _id: new mongoose.Types.ObjectId(), // Generate ID untuk sub-dokumen
      siswa: req.user.id,
      filePath: req.file.path,
      fileName: req.file.originalname,
    };

    const tugas = await Tugas.findOneAndUpdate(
      { _id: id, "submissions.siswa": { $ne: req.user.id } }, // Pastikan siswa belum submit
      { $push: { submissions: submission } },
      { new: true }
    );

    if (!tugas) {
      fs.unlinkSync(req.file.path); // Hapus file jika gagal submit (misal: sudah pernah submit)
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
    // Pastikan guru yang mengakses adalah guru yang membuat tugas
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

    // Cari tugas yang berisi submission yang sesuai
    const tugas = await Tugas.findOne({
      "submissions._id": submissionId,
      guru: req.user.id,
    });

    if (!tugas) {
      return res.status(404).json({
        message: "Submission tidak ditemukan atau Anda tidak berhak menilai.",
      });
    }

    // Dapatkan submission yang spesifik
    const submission = tugas.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission tidak ditemukan." });
    }

    // Update nilai dan feedback di dalam tugas
    submission.nilai = nilai;
    submission.feedback = feedback;
    await tugas.save();

    // **LOGIKA BARU: Simpan nilai ke koleksi Nilai**
    // Menggunakan updateOne dengan upsert: jika sudah ada nilai tugas yg sama, akan diupdate. Jika belum, akan dibuat.
    await Nilai.updateOne(
      {
        siswa: submission.siswa,
        mataPelajaran: tugas.mataPelajaran,
        // Gunakan ID tugas sebagai pengenal unik untuk jenis penilaian tugas
        // Ini mencegah duplikasi jika guru menilai ulang
        jenisPenilaian: "tugas",
        deskripsi: `Tugas: ${tugas.judul}`, // Deskripsi bisa disesuaikan
        // Tambahkan filter lain jika perlu untuk memastikan keunikan, misal semester & tahun ajaran jika ada di model Tugas
      },
      {
        $set: {
          nilai: nilai,
          guru: req.user.id,
          kelas: tugas.kelas,
          // Anda perlu menambahkan semester dan tahunAjaran ke model Tugas jika ingin ini lebih akurat
          // Untuk sekarang, kita asumsikan ini diisi manual nanti atau diambil dari data lain
          semester: "ganjil", // Contoh, sebaiknya diambil dari data Tugas
          tahunAjaran: "2025/2026", // Contoh, sebaiknya diambil dari data Tugas
        },
      },
      { upsert: true } // Opsi ini krusial
    );

    res.json({ message: "Nilai berhasil disimpan dan disentralisasi." });
  } catch (error) {
    console.error("Error grading submission:", error);
    res.status(500).json({ message: "Gagal menyimpan nilai." });
  }
};
