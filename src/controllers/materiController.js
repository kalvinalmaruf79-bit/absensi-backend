// src/controllers/materiController.js
const Materi = require("../models/Materi");
const Jadwal = require("../models/Jadwal");
const { uploadFromBuffer, deleteFile } = require("../utils/cloudinary");

exports.createMateri = async (req, res) => {
  let filesToSave = [];
  try {
    const { judul, deskripsi, mataPelajaran, kelas, parsedLinks } = req.body;

    if (!judul || !deskripsi || !mataPelajaran || !kelas) {
      return res.status(400).json({ message: "Semua field wajib diisi." });
    }

    // Validasi apakah guru mengajar di kelas dan mata pelajaran ini
    const jadwal = await Jadwal.findOne({
      guru: req.user.id,
      kelas: kelas,
      mataPelajaran: mataPelajaran,
      isActive: true,
    });

    if (!jadwal) {
      return res.status(403).json({
        message: "Anda tidak mengajar mata pelajaran ini di kelas tersebut.",
      });
    }

    // Upload files ke Cloudinary
    if (req.files && req.files.length > 0) {
      if (req.files.length > 5) {
        return res.status(400).json({ message: "Maksimal 5 file." });
      }

      for (const file of req.files) {
        const result = await uploadFromBuffer(file.buffer, "materi-pelajaran");
        filesToSave.push({
          fileName: file.originalname,
          url: result.secure_url,
          public_id: result.public_id,
          fileType: file.mimetype,
        });
      }
    }

    const materi = new Materi({
      judul,
      deskripsi,
      mataPelajaran,
      kelas,
      guru: req.user.id,
      files: filesToSave,
      links: parsedLinks || [],
    });

    await materi.save();
    res.status(201).json({ message: "Materi berhasil dibuat.", materi });
  } catch (error) {
    console.error("Error creating materi:", error);
    // Rollback: hapus file yang sudah terunggah
    if (filesToSave && filesToSave.length > 0) {
      for (const file of filesToSave) {
        try {
          await deleteFile(file.public_id);
        } catch (delError) {
          console.error("Error deleting file during rollback:", delError);
        }
      }
    }
    res
      .status(500)
      .json({ message: "Gagal membuat materi.", error: error.message });
  }
};

exports.getMateri = async (req, res) => {
  try {
    const { kelasId, mataPelajaranId } = req.query;
    if (!kelasId || !mataPelajaranId) {
      return res.status(400).json({
        message: "Parameter kelasId dan mataPelajaranId wajib diisi.",
      });
    }

    let filter = {
      kelas: kelasId,
      mataPelajaran: mataPelajaranId,
    };

    // Siswa hanya bisa melihat materi yang sudah dipublish
    if (req.user.role === "siswa") {
      filter.isPublished = true;
    }

    const materi = await Materi.find(filter)
      .populate("guru", "name")
      .populate("mataPelajaran", "nama kode")
      .populate("kelas", "nama tingkat jurusan")
      .sort({ createdAt: -1 });

    res.json(materi);
  } catch (error) {
    console.error("Error getting materi:", error);
    res.status(500).json({ message: "Gagal mengambil materi." });
  }
};

exports.getMateriById = async (req, res) => {
  try {
    const { id } = req.params;
    const materi = await Materi.findById(id)
      .populate("guru", "name")
      .populate("kelas", "nama tingkat jurusan")
      .populate("mataPelajaran", "nama kode");

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    // Validasi akses untuk siswa - hanya bisa lihat yang published
    if (req.user.role === "siswa" && !materi.isPublished) {
      return res.status(403).json({
        message: "Materi ini belum dipublikasikan.",
      });
    }

    // Validasi akses untuk guru
    if (
      req.user.role === "guru" &&
      materi.guru._id.toString() !== req.user.id
    ) {
      // Izinkan jika guru masih mengajar di kelas & mapel tersebut
      const isTeaching = await Jadwal.findOne({
        guru: req.user.id,
        kelas: materi.kelas._id,
        mataPelajaran: materi.mataPelajaran._id,
        isActive: true,
      });
      if (!isTeaching) {
        return res
          .status(403)
          .json({ message: "Anda tidak berhak mengakses materi ini." });
      }
    }

    res.json(materi);
  } catch (error) {
    console.error("Error getting materi by id:", error);
    res.status(500).json({ message: "Gagal mengambil materi." });
  }
};

exports.getMateriByMataPelajaran = async (req, res) => {
  try {
    const { mataPelajaranId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Untuk siswa, ambil kelas dari user
    let kelasId;
    if (req.user.role === "siswa") {
      const siswa = await require("../models/User")
        .findById(req.user.id)
        .select("kelas");

      if (!siswa || !siswa.kelas) {
        return res.status(400).json({
          message: "Data kelas siswa tidak ditemukan.",
        });
      }
      kelasId = siswa.kelas;
    }

    let filter = {
      mataPelajaran: mataPelajaranId,
    };

    if (req.user.role === "siswa") {
      filter.isPublished = true;
      filter.kelas = kelasId;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: "guru", select: "name" },
        { path: "mataPelajaran", select: "nama kode" },
        { path: "kelas", select: "nama tingkat jurusan" },
      ],
    };

    const result = await Materi.paginate(filter, options);

    res.json({
      docs: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    });
  } catch (error) {
    console.error("Error getting materi by mata pelajaran:", error);
    res.status(500).json({ message: "Gagal mengambil materi." });
  }
};

exports.getMateriSiswa = async (req, res) => {
  try {
    const { page = 1, limit = 10, mataPelajaranId } = req.query;

    // Ambil kelas siswa
    const siswa = await require("../models/User")
      .findById(req.user.id)
      .select("kelas");

    if (!siswa || !siswa.kelas) {
      return res.status(400).json({
        message: "Data kelas siswa tidak ditemukan.",
      });
    }

    let filter = {
      kelas: siswa.kelas,
      isPublished: true,
    };

    // Filter berdasarkan mata pelajaran jika disediakan
    if (mataPelajaranId) {
      filter.mataPelajaran = mataPelajaranId;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: "guru", select: "name" },
        { path: "mataPelajaran", select: "nama kode" },
        { path: "kelas", select: "nama tingkat jurusan" },
      ],
    };

    const result = await Materi.paginate(filter, options);

    res.json({
      docs: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    });
  } catch (error) {
    console.error("Error getting materi siswa:", error);
    res.status(500).json({ message: "Gagal mengambil materi." });
  }
};

exports.togglePublishMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const materi = await Materi.findById(id);

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    if (materi.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak mengubah materi ini." });
    }

    materi.isPublished = !materi.isPublished;
    await materi.save();

    res.json({
      message: `Materi berhasil ${
        materi.isPublished ? "diterbitkan" : "disembunyikan"
      }.`,
      materi,
    });
  } catch (error) {
    console.error("Error toggling publish materi:", error);
    res.status(500).json({ message: "Gagal mengubah status publikasi." });
  }
};

exports.updateMateri = async (req, res) => {
  let newFilesToSave = [];
  try {
    const { id } = req.params;
    const { judul, deskripsi, parsedLinks, mataPelajaran, kelas } = req.body;

    const materi = await Materi.findById(id);

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    if (materi.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak mengubah materi ini." });
    }

    // Validasi hak akses jika kelas atau mapel diubah
    const targetKelas = kelas || materi.kelas;
    const targetMataPelajaran = mataPelajaran || materi.mataPelajaran;

    if (
      kelas ||
      mataPelajaran ||
      !materi.kelas.equals(targetKelas) ||
      !materi.mataPelajaran.equals(targetMataPelajaran)
    ) {
      const jadwal = await Jadwal.findOne({
        guru: req.user.id,
        kelas: targetKelas,
        mataPelajaran: targetMataPelajaran,
        isActive: true,
      });

      if (!jadwal) {
        return res.status(403).json({
          message: "Anda tidak mengajar di kelas atau mata pelajaran tujuan.",
        });
      }
      materi.kelas = targetKelas;
      materi.mataPelajaran = targetMataPelajaran;
    }

    // Update basic info
    materi.judul = judul || materi.judul;
    materi.deskripsi = deskripsi || materi.deskripsi;

    // Upload new files jika ada
    if (req.files && req.files.length > 0) {
      const totalFiles = materi.files.length + req.files.length;
      if (totalFiles > 5) {
        return res.status(400).json({ message: "Maksimal 5 file." });
      }

      for (const file of req.files) {
        const result = await uploadFromBuffer(file.buffer, "materi-pelajaran");
        newFilesToSave.push({
          fileName: file.originalname,
          url: result.secure_url,
          public_id: result.public_id,
          fileType: file.mimetype,
        });
      }
      materi.files.push(...newFilesToSave);
    }

    // Update links jika ada
    if (parsedLinks) {
      materi.links = parsedLinks;
    }

    await materi.save();
    res.json({ message: "Materi berhasil diupdate.", materi });
  } catch (error) {
    console.error("Error updating materi:", error);
    // Rollback: hapus file baru yang sudah terunggah
    if (newFilesToSave && newFilesToSave.length > 0) {
      for (const file of newFilesToSave) {
        try {
          await deleteFile(file.public_id);
        } catch (delError) {
          console.error("Error deleting file during rollback:", delError);
        }
      }
    }
    res.status(500).json({ message: "Gagal mengupdate materi." });
  }
};

exports.deleteMateriFile = async (req, res) => {
  try {
    const { id, publicId } = req.params;

    const decodedPublicId = decodeURIComponent(publicId);

    const materi = await Materi.findById(id);

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    if (materi.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak mengubah materi ini." });
    }

    const fileIndex = materi.files.findIndex(
      (f) => f.public_id === decodedPublicId
    );

    if (fileIndex === -1) {
      return res.status(404).json({ message: "File tidak ditemukan." });
    }

    await deleteFile(decodedPublicId);

    materi.files.splice(fileIndex, 1);
    await materi.save();

    res.json({ message: "File berhasil dihapus.", materi });
  } catch (error) {
    console.error("Error deleting materi file:", error);
    res.status(500).json({ message: "Gagal menghapus file." });
  }
};

exports.deleteMateri = async (req, res) => {
  try {
    const { id } = req.params;
    const materi = await Materi.findById(id);

    if (!materi) {
      return res.status(404).json({ message: "Materi tidak ditemukan." });
    }

    if (materi.guru.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak menghapus materi ini." });
    }

    if (materi.files && materi.files.length > 0) {
      for (const file of materi.files) {
        if (file.public_id) {
          try {
            await deleteFile(file.public_id);
          } catch (delError) {
            console.error("Error deleting file:", delError);
          }
        }
      }
    }

    await materi.deleteOne();

    res.json({ message: "Materi dan semua file terkait berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting materi:", error);
    res.status(500).json({ message: "Gagal menghapus materi." });
  }
};
