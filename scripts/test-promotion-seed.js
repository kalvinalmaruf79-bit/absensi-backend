// scripts/test-promotion-seed.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Import Models
const User = require("../src/models/User");
const Kelas = require("../src/models/Kelas");
const MataPelajaran = require("../src/models/MataPelajaran");
const Nilai = require("../src/models/Nilai");
const Absensi = require("../src/models/Absensi");
const Jadwal = require("../src/models/Jadwal");
const Settings = require("../src/models/Settings");
const AcademicRules = require("../src/models/AcademicRules");

const MONGO_URI = process.env.DB_URI;

const seedData = async () => {
  try {
    if (!MONGO_URI) throw new Error("DB_URI tidak ditemukan di .env");

    await mongoose.connect(MONGO_URI);
    console.log(`✅ Terhubung ke Database: ${MONGO_URI}`);

    // 1. BERSIHKAN DATABASE
    console.log("🧹 Membersihkan data lama...");
    await Promise.all([
      User.deleteMany({}),
      Kelas.deleteMany({}),
      MataPelajaran.deleteMany({}),
      Nilai.deleteMany({}),
      Absensi.deleteMany({}),
      Jadwal.deleteMany({}),
      Settings.deleteMany({}),
      AcademicRules.deleteMany({}),
    ]);

    // 2. SETUP SETTINGS
    console.log("⚙️  Setup System...");
    await Settings.create({
      key: "global-settings",
      namaSekolah: "SMK Testing Lokal",
      semesterAktif: "genap",
      tahunAjaranAktif: "2024/2025",
    });

    await AcademicRules.create({
      promotion: {
        minAttendancePercentage: 80,
        maxSubjectsBelowPassingGrade: 2,
        passingGrade: 70,
      },
    });

    // 3. SUPER ADMIN
    console.log("👑 Create Admin...");
    const hashedPassword = await bcrypt.hash("password123", 10);

    const admin = await User.create({
      name: "Super Admin",
      email: "superadmin@sekolah.com",
      identifier: "superadmin",
      password: hashedPassword,
      role: "super_admin",
      isPasswordDefault: false,
    });

    // 4. MASTER DATA
    console.log("📚 Create Master Data...");
    const guruId = new mongoose.Types.ObjectId(); // Dummy Guru ID

    const mapelMTK = await MataPelajaran.create({
      nama: "Matematika",
      kode: "MTK",
      createdBy: admin._id,
    });
    const mapelIND = await MataPelajaran.create({
      nama: "B. Indonesia",
      kode: "IND",
      createdBy: admin._id,
    });
    const mapelING = await MataPelajaran.create({
      nama: "B. Inggris",
      kode: "ING",
      createdBy: admin._id,
    });
    const listMapel = [mapelMTK, mapelIND, mapelING];

    // Kelas Asal & Tujuan
    const kelasAsal = await Kelas.create({
      nama: "X RPL A",
      tingkat: "X",
      jurusan: "RPL",
      tahunAjaran: "2024/2025",
      isActive: true,
      createdBy: admin._id,
    });

    const kelasNaik = await Kelas.create({
      nama: "XI RPL A",
      tingkat: "XI",
      jurusan: "RPL",
      tahunAjaran: "2025/2026",
      isActive: true,
      createdBy: admin._id,
    });

    const kelasTinggal = await Kelas.create({
      nama: "X RPL A",
      tingkat: "X",
      jurusan: "RPL",
      tahunAjaran: "2025/2026",
      isActive: true,
      createdBy: admin._id,
    });

    // 5. JADWAL (Ganjil & Genap)
    // HARI HARUS HURUF KECIL 'senin'
    const jGanjil = await Jadwal.create({
      kelas: kelasAsal._id,
      mataPelajaran: mapelMTK._id,
      guru: guruId,
      hari: "senin",
      jamMulai: "07:00",
      jamSelesai: "08:00",
      semester: "ganjil",
      tahunAjaran: "2024/2025",
      createdBy: admin._id,
    });
    const jGenap = await Jadwal.create({
      kelas: kelasAsal._id,
      mataPelajaran: mapelMTK._id,
      guru: guruId,
      hari: "senin",
      jamMulai: "07:00",
      jamSelesai: "08:00",
      semester: "genap",
      tahunAjaran: "2024/2025",
      createdBy: admin._id,
    });

    // 6. SISWA & DATA AKADEMIK
    console.log("👨‍🎓 Create Students...");

    for (let i = 1; i <= 10; i++) {
      const siswa = await User.create({
        name: `Siswa Test ${i}`,
        email: `siswa${i}@test.com`,
        identifier: `NIS${i}`,
        password: hashedPassword,
        role: "siswa",
        kelas: kelasAsal._id,
        isActive: true,
      });

      await Kelas.findByIdAndUpdate(kelasAsal._id, {
        $push: { siswa: siswa._id },
      });

      // === SKENARIO ===
      // Kita tambahkan parameter kelasAsal._id ke fungsi createNilai
      if (i <= 7) {
        // NAIK
        await createAbsensi(siswa._id, jGanjil._id, 16, 0);
        await createAbsensi(siswa._id, jGenap._id, 16, 0);
        // Perbaikan: Pass kelasAsal._id
        await createNilai(
          siswa._id,
          kelasAsal._id,
          listMapel,
          85,
          "ganjil",
          admin._id
        );
        await createNilai(
          siswa._id,
          kelasAsal._id,
          listMapel,
          90,
          "genap",
          admin._id
        );
      } else if (i === 8) {
        // TINGGAL (Absensi)
        await createAbsensi(siswa._id, jGanjil._id, 12, 4);
        await createAbsensi(siswa._id, jGenap._id, 2, 14);
        await createNilai(
          siswa._id,
          kelasAsal._id,
          listMapel,
          80,
          "ganjil",
          admin._id
        );
        await createNilai(
          siswa._id,
          kelasAsal._id,
          listMapel,
          80,
          "genap",
          admin._id
        );
      } else {
        // TINGGAL (Nilai)
        await createAbsensi(siswa._id, jGanjil._id, 16, 0);
        await createAbsensi(siswa._id, jGenap._id, 16, 0);
        await createNilai(
          siswa._id,
          kelasAsal._id,
          listMapel,
          50,
          "ganjil",
          admin._id
        );
        await createNilai(
          siswa._id,
          kelasAsal._id,
          listMapel,
          45,
          "genap",
          admin._id
        );
      }
    }

    console.log("✅ SEEDING SELESAI! Data siap ditest.");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
};

// --- HELPER FUNCTIONS ---

async function createAbsensi(siswa, jadwal, hadir, alpa) {
  const docs = [];
  const baseDate = new Date();
  let meetingCount = 0;

  for (let k = 0; k < hadir; k++) {
    const tgl = new Date(baseDate);
    tgl.setDate(baseDate.getDate() - meetingCount * 7);
    docs.push({
      siswa,
      jadwal,
      status: "Hadir",
      keterangan: "hadir",
      tanggal: tgl.toISOString().split("T")[0], // Ubah jadi string YYYY-MM-DD
    });
    meetingCount++;
  }

  for (let k = 0; k < alpa; k++) {
    const tgl = new Date(baseDate);
    tgl.setDate(baseDate.getDate() - meetingCount * 7);
    docs.push({
      siswa,
      jadwal,
      status: "Alpa",
      keterangan: "alpa",
      tanggal: tgl.toISOString().split("T")[0], // Ubah jadi string YYYY-MM-DD
    });
    meetingCount++;
  }

  if (docs.length) await Absensi.insertMany(docs);
}

// Perbaikan: Tambahkan parameter 'kelas'
async function createNilai(siswa, kelas, mapels, nilai, sem, guruId) {
  const docs = mapels.map((m) => ({
    siswa,
    kelas: kelas, // Field ini wajib di model Nilai Anda
    mataPelajaran: m._id,
    guru: guruId,
    jenisPenilaian: "uas", // Harus huruf kecil ('uas') sesuai enum
    nilai,
    semester: sem,
    tahunAjaran: "2024/2025",
  }));
  await Nilai.insertMany(docs);
}

seedData();
