// src/controllers/akademikController.js
const User = require("../models/User");
const Nilai = require("../models/Nilai");
const Absensi = require("../models/Absensi");
const Kelas = require("../models/Kelas");
const MataPelajaran = require("../models/MataPelajaran");

/**
 * @summary Menghasilkan Rapor Siswa untuk semester tertentu
 */
exports.generateRaporSiswa = async (req, res) => {
  try {
    const { siswaId } = req.params;
    const { tahunAjaran, semester } = req.query;

    if (!tahunAjaran || !semester) {
      return res.status(400).json({
        message: "Parameter query 'tahunAjaran' dan 'semester' wajib diisi.",
      });
    }

    // 1. Ambil data siswa
    const siswa = await User.findById(siswaId).populate({
      path: "riwayatKelas.kelas",
      select: "nama tingkat jurusan waliKelas",
      populate: { path: "waliKelas", select: "name" },
    });

    if (!siswa || siswa.role !== "siswa") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    // 2. Ambil semua nilai pada periode tersebut
    const nilaiRecords = await Nilai.find({
      siswa: siswaId,
      tahunAjaran,
      semester,
    })
      .populate("mataPelajaran", "nama kode")
      .sort("mataPelajaran");

    // 3. Ambil rekap absensi pada periode tersebut
    const absensiRecords = await Absensi.aggregate([
      {
        $match: {
          siswa: siswa._id,
          // Anda perlu menambahkan tahunAjaran dan semester pada model Absensi jika ingin filter lebih akurat
          // Untuk saat ini, kita filter berdasarkan tanggal yang mendekati
        },
      },
      {
        $group: {
          _id: "$keterangan",
          jumlah: { $sum: 1 },
        },
      },
    ]);

    const rekapAbsensi = {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
    };
    absensiRecords.forEach((item) => {
      rekapAbsensi[item._id] = item.jumlah;
    });

    // 4. Strukturkan data rapor
    const rapor = {
      informasiSiswa: {
        nama: siswa.name,
        nis: siswa.identifier,
        kelas:
          siswa.riwayatKelas.find((r) => r.tahunAjaran === tahunAjaran)?.kelas
            ?.nama || siswa.kelas.nama,
        tahunAjaran,
        semester,
        waliKelas:
          siswa.riwayatKelas.find((r) => r.tahunAjaran === tahunAjaran)?.kelas
            ?.waliKelas?.name || "N/A",
      },
      nilaiAkademik: nilaiRecords.map((n) => ({
        mataPelajaran: n.mataPelajaran.nama,
        kodeMapel: n.mataPelajaran.kode,
        nilai: n.nilai,
        jenis: n.jenisPenilaian,
        deskripsi: n.deskripsi,
      })),
      rekapAbsensi,
      catatanWaliKelas: "Tetap semangat dan tingkatkan lagi prestasimu!", // Contoh
    };

    res.json(rapor);
  } catch (error) {
    console.error("Error generating rapor:", error);
    res
      .status(500)
      .json({ message: "Gagal membuat rapor.", error: error.message });
  }
};

/**
 * @summary Menghasilkan Transkrip Nilai Kumulatif Siswa
 */
exports.generateTranskripSiswa = async (req, res) => {
  try {
    const { siswaId } = req.params;

    // 1. Ambil data siswa
    const siswa = await User.findById(siswaId);
    if (!siswa || siswa.role !== "siswa") {
      return res.status(404).json({ message: "Siswa tidak ditemukan." });
    }

    // 2. Ambil semua nilai siswa selama bersekolah
    const semuaNilai = await Nilai.find({ siswa: siswaId })
      .populate("mataPelajaran", "nama kode")
      .populate("kelas", "nama tahunAjaran")
      .sort("tahunAjaran semester mataPelajaran");

    // 3. Kelompokkan nilai berdasarkan semester dan tahun ajaran
    const transkrip = {};
    semuaNilai.forEach((nilai) => {
      const key = `${nilai.tahunAjaran} - Semester ${nilai.semester}`;
      if (!transkrip[key]) {
        transkrip[key] = {
          kelas: nilai.kelas?.nama || "Tidak diketahui",
          nilai: [],
        };
      }
      transkrip[key].nilai.push({
        mataPelajaran: nilai.mataPelajaran.nama,
        kodeMapel: nilai.mataPelajaran.kode,
        nilai: nilai.nilai,
      });
    });

    // 4. Hitung IPK (Indeks Prestasi Kumulatif) - contoh sederhana
    const totalNilai = semuaNilai.reduce((acc, curr) => acc + curr.nilai, 0);
    const ipk =
      semuaNilai.length > 0 ? (totalNilai / semuaNilai.length).toFixed(2) : 0;

    res.json({
      informasiSiswa: {
        nama: siswa.name,
        nis: siswa.identifier,
      },
      ipk: ipk,
      detailTranskrip: transkrip,
    });
  } catch (error) {
    console.error("Error generating transkrip:", error);
    res
      .status(500)
      .json({ message: "Gagal membuat transkrip.", error: error.message });
  }
};
