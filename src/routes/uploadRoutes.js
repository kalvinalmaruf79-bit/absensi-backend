// routes/uploadRoutes.js (Fixed for consistency)
const express = require("express");
const router = express.Router();
const Jimp = require("jimp").default;
const QrCode = require("qrcode-reader");
const { authMiddleware } = require("../middleware/authMiddleware");
const absensiController = require("../controllers/absensiController");

router.post("/upload-screenshot", authMiddleware, async (req, res, next) => {
  if (!req.files || !req.files.image) {
    return res.status(400).json({ message: "❌ Gambar tidak ditemukan." });
  }

  try {
    const imageBuffer = req.files.image.data;
    const image = await Jimp.read(imageBuffer);
    const qr = new QrCode();

    qr.callback = async function (err, value) {
      if (err || !value || !value.result) {
        return res
          .status(400)
          .json({ message: "❌ Gagal membaca QR Code dari gambar." });
      }

      let parsedData;
      try {
        parsedData = JSON.parse(value.result);
      } catch (e) {
        return res
          .status(400)
          .json({ message: "❌ Format QR Code tidak valid." });
      }

      const kodeSesi = parsedData.KODE_SESI || parsedData.kode_sesi;

      if (!kodeSesi) {
        return res
          .status(400)
          .json({ message: "❌ Kode sesi tidak ditemukan dalam QR Code." });
      }

      // Teruskan ke absensiController.checkIn
      req.body.kodeSesi = kodeSesi;
      // Asumsi lokasi didapat dari EXIF atau body request lain jika ada
      // Jika tidak, Anda harus mengirimkannya juga
      if (!req.body.latitude || !req.body.longitude) {
        // Anda bisa set lokasi default atau menolak jika tidak ada
        // Untuk contoh ini, saya akan menolaknya
        return res
          .status(400)
          .json({
            message: "❌ Data lokasi (latitude/longitude) tidak ditemukan.",
          });
      }

      absensiController.checkIn(req, res, next);
    };

    qr.decode(image.bitmap);
  } catch (err) {
    console.error("❌ ERROR saat upload screenshot:", err);
    return res
      .status(500)
      .json({ message: "Terjadi kesalahan saat memproses gambar." });
  }
});

module.exports = router;
