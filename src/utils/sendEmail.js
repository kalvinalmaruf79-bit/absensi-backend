// src/utils/sendEmail.js
const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // 1. Buat transporter (layanan yang akan mengirim email, cth: Gmail)
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true, // true untuk port 465, false untuk port lain
    auth: {
      user: process.env.EMAIL_USER, // user email
      pass: process.env.EMAIL_PASS, // app password
    },
  });

  // 2. Definisikan opsi email (penerima, subjek, isi, dll)
  const mailOptions = {
    from: `"Sistem Akademik" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // 3. Kirim email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
