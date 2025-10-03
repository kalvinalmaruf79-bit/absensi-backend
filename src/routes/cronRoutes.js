// src/routes/cronRoutes.js
const express = require("express");
const router = express.Router();
const {
  sendPresenceReminders,
  notifyLateStudents,
  sendWeeklyReports, // <-- 1. Impor fungsi baru
} = require("../controllers/cronController");

// Middleware untuk melindungi cron job dari akses publik
const verifyCronSecret = (req, res, next) => {
  const cronSecret = req.header("Authorization");
  if (!cronSecret || cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Endpoint untuk pengingat presensi
router.post("/presence-reminder", verifyCronSecret, sendPresenceReminders);

// Endpoint untuk notifikasi siswa yang alpa
router.post("/notify-late-students", verifyCronSecret, notifyLateStudents);

// <-- 2. Endpoint baru untuk laporan mingguan
router.post("/weekly-report", verifyCronSecret, sendWeeklyReports);

module.exports = router;
