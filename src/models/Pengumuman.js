// src/models/Pengumuman.js
const mongoose = require("mongoose");

const pengumumanSchema = new mongoose.Schema(
  {
    judul: {
      type: String,
      required: [true, "Judul pengumuman wajib diisi"],
      trim: true,
      maxlength: [200, "Judul maksimal 200 karakter"],
    },
    isi: {
      type: String,
      required: [true, "Isi pengumuman wajib diisi"],
    },
    pembuat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetRole: {
      type: String,
      enum: ["semua", "guru", "siswa"],
      default: "semua",
    },
    targetKelas: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Kelas",
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index untuk performa query
pengumumanSchema.index({ targetRole: 1, isPublished: 1, createdAt: -1 });
pengumumanSchema.index({ targetKelas: 1, isPublished: 1 });
pengumumanSchema.index({ pembuat: 1 });

// Middleware untuk set publishedAt saat dipublish
pengumumanSchema.pre("save", function (next) {
  if (this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model("Pengumuman", pengumumanSchema);
