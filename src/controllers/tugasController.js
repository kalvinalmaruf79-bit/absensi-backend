// src/controllers/tugasController.js
const Tugas = require("../models/Tugas");
const Nilai = require("../models/Nilai");
const User = require("../models/User");
const Notifikasi = require("../models/Notifikasi");
const ActivityLog = require("../models/ActivityLog");
const sendPushNotification = require("../utils/sendPushNotification");
const { uploadFromBuffer, deleteFile } = require("../utils/cloudinary");
const mongoose = require("mongoose");

// Helper
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

// Create Tugas
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

    const siswaDiKelas = await User.find({
      kelas: kelas,
      role: "siswa",
    }).select("_id deviceTokens");

    const siswaIds = siswaDiKelas.map((s) => s._id);
    const playerIds = siswaDiKelas.flatMap((s) => s.deviceTokens);

    await createBulkNotifikasi(
      siswaIds,
      "tugas_baru",
      `Tugas Baru: ${judul}`,
      "Sebuah tugas baru telah ditambahkan.",
      tugas._id
    );

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

// Get Tugas
exports.getTugasByKelas = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId } = req.query;
    const tugas = await Tugas.find({
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    })
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier")
      .sort({ deadline: 1 });
    res.json(tugas);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil tugas." });
  }
};

// Get Single Tugas by ID
exports.getTugasById = async (req, res) => {
  try {
    const { id } = req.params;
    const tugas = await Tugas.findById(id)
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode")
      .populate("guru", "name identifier")
      .populate("submissions.siswa", "name identifier");

    if (!tugas) {
      return res.status(404).json({ message: "Tugas tidak ditemukan." });
    }

    res.json(tugas);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil detail tugas." });
  }
};

// Update Tugas
exports.updateTugas = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      judul,
      deskripsi,
      mataPelajaran,
      kelas,
      deadline,
      semester,
      tahunAjaran,
    } = req.body;

    const tugas = await Tugas.findById(id);
    if (!tugas) {
      return res.status(404).json({ message: "Tugas tidak ditemukan." });
    }

    if (tugas.guru.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Anda tidak memiliki akses untuk mengubah tugas ini.",
      });
    }

    if (judul !== undefined) tugas.judul = judul;
    if (deskripsi !== undefined) tugas.deskripsi = deskripsi;
    if (mataPelajaran !== undefined) tugas.mataPelajaran = mataPelajaran;
    if (kelas !== undefined) tugas.kelas = kelas;
    if (deadline !== undefined) tugas.deadline = deadline;
    if (semester !== undefined) tugas.semester = semester;
    if (tahunAjaran !== undefined) tugas.tahunAjaran = tahunAjaran;

    await tugas.save();

    await tugas.populate([
      { path: "kelas", select: "nama tingkat jurusan" },
      { path: "mataPelajaran", select: "nama kode" },
      { path: "guru", select: "name identifier" },
    ]);

    User.find({
      kelas: tugas.kelas._id,
      role: "siswa",
      isActive: true,
    })
      .select("_id deviceTokens")
      .then((siswaDiKelas) => {
        if (siswaDiKelas.length > 0) {
          const siswaIds = siswaDiKelas.map((s) => s._id);
          const playerIds = siswaDiKelas.flatMap((s) => s.deviceTokens || []);

          createBulkNotifikasi(
            siswaIds,
            "tugas_diubah",
            `Tugas Diperbarui: ${tugas.judul}`,
            "Tugas telah mengalami perubahan. Cek detailnya!",
            tugas._id
          ).catch((err) => console.error("Error creating notifications:", err));

          if (playerIds.length > 0) {
            sendPushNotification(
              playerIds,
              `Tugas Diperbarui: ${tugas.judul}`,
              "Ada perubahan pada tugas. Lihat detailnya di aplikasi!",
              {
                type: "tugas_diubah",
                resourceId: tugas._id.toString(),
              }
            );
          }
        }
      })
      .catch((err) => console.error("Error fetching students:", err));

    res.json({ message: "Tugas berhasil diperbarui.", tugas });
  } catch (error) {
    console.error("Error updating tugas:", error);
    res.status(500).json({
      message: "Gagal memperbarui tugas.",
      error: error.message,
    });
  }
};

// Delete Tugas
exports.deleteTugas = async (req, res) => {
  try {
    const { id } = req.params;

    const tugas = await Tugas.findById(id);
    if (!tugas) {
      return res.status(404).json({ message: "Tugas tidak ditemukan." });
    }

    if (tugas.guru.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Anda tidak memiliki akses untuk menghapus tugas ini.",
      });
    }

    const tugasJudul = tugas.judul;
    const tugasKelasId = tugas.kelas;
    const tugasMataPelajaran = tugas.mataPelajaran;
    const tugasSemester = tugas.semester;
    const tugasTahunAjaran = tugas.tahunAjaran;

    if (tugas.submissions && tugas.submissions.length > 0) {
      const deletePromises = tugas.submissions
        .filter((sub) => sub.public_id)
        .map((sub) =>
          deleteFile(sub.public_id).catch((err) =>
            console.error(`Gagal menghapus file ${sub.public_id}:`, err)
          )
        );

      Promise.all(deletePromises).catch((err) =>
        console.error("Error deleting files:", err)
      );
    }

    // PERUBAHAN: Menghapus nilai berdasarkan ID tugas, bukan deskripsi
    Nilai.deleteMany({
      tugas: tugas._id,
    }).catch((err) => console.error("Error deleting nilai:", err));

    await tugas.deleteOne();

    User.find({
      kelas: tugasKelasId,
      role: "siswa",
      isActive: true,
    })
      .select("_id deviceTokens")
      .then((siswaDiKelas) => {
        if (siswaDiKelas.length > 0) {
          const siswaIds = siswaDiKelas.map((s) => s._id);
          const playerIds = siswaDiKelas.flatMap((s) => s.deviceTokens || []);

          createBulkNotifikasi(
            siswaIds,
            "tugas_dihapus",
            `Tugas Dihapus: ${tugasJudul}`,
            "Tugas telah dihapus oleh guru.",
            null
          ).catch((err) => console.error("Error creating notifications:", err));

          if (playerIds.length > 0) {
            sendPushNotification(
              playerIds,
              `Tugas Dihapus: ${tugasJudul}`,
              "Tugas telah dihapus oleh guru.",
              {
                type: "tugas_dihapus",
              }
            );
          }
        }
      })
      .catch((err) => console.error("Error fetching students:", err));

    res.json({ message: "Tugas berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting tugas:", error);
    res.status(500).json({
      message: "Gagal menghapus tugas.",
      error: error.message,
    });
  }
};

// Submit Tugas (Siswa)
exports.submitTugas = async (req, res) => {
  try {
    const { id } = req.params;
    const siswaId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ message: "File tugas wajib diunggah." });
    }

    const tugas = await Tugas.findById(id);
    if (!tugas) {
      return res.status(404).json({ message: "Tugas tidak ditemukan." });
    }

    if (new Date() > new Date(tugas.deadline)) {
      return res
        .status(400)
        .json({ message: "Waktu pengumpulan tugas telah berakhir." });
    }

    const existingSubmission = tugas.submissions.find(
      (sub) => sub.siswa.toString() === siswaId
    );
    if (existingSubmission && existingSubmission.public_id) {
      await deleteFile(existingSubmission.public_id);
    }

    const result = await uploadFromBuffer(req.file.buffer, "jawaban-tugas");

    const newSubmission = {
      _id: new mongoose.Types.ObjectId(),
      siswa: siswaId,
      url: result.secure_url,
      public_id: result.public_id,
      fileName: req.file.originalname,
    };

    if (existingSubmission) {
      existingSubmission.set(newSubmission);
    } else {
      tugas.submissions.push(newSubmission);
    }

    await tugas.save();

    ActivityLog.create({
      user: siswaId,
      action: "SUBMIT_TUGAS",
      details: `Mengumpulkan tugas '${tugas.judul}'`,
      resourceId: tugas._id,
    }).catch((err) => console.error("Gagal mencatat log submit tugas:", err));

    res.json({ message: "Tugas berhasil dikumpulkan." });
  } catch (error) {
    console.error("Error submitting tugas:", error);
    res.status(500).json({ message: "Gagal mengumpulkan tugas." });
  }
};

// Get Submissions
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

// Grade Submission
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

    // --- PERUBAHAN UTAMA: Menautkan Nilai dengan Tugas ---
    const nilaiRecord = await Nilai.findOneAndUpdate(
      {
        siswa: submission.siswa,
        tugas: tugas._id, // Filter berdasarkan ID tugas, bukan deskripsi
      },
      {
        $set: {
          nilai: nilai,
          deskripsi: `Nilai untuk tugas: ${tugas.judul}`, // Deskripsi tetap informatif
          // Data lain yang diperlukan
          mataPelajaran: tugas.mataPelajaran,
          guru: req.user.id,
          kelas: tugas.kelas,
          semester: tugas.semester,
          tahunAjaran: tugas.tahunAjaran,
          jenisPenilaian: "tugas",
        },
      },
      { upsert: true, new: true }
    );
    // --------------------------------------------------

    const notif = new Notifikasi({
      penerima: submission.siswa,
      tipe: "nilai_baru",
      judul: `Nilai Tugas: ${tugas.judul}`,
      pesan: `Anda mendapatkan nilai ${nilai} untuk tugas ini.`,
      resourceId: nilaiRecord._id, // resourceId merujuk ke dokumen Nilai
    });
    await notif.save();

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
