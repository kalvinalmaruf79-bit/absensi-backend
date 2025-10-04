// src/models/Materi.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const materiSchema = new mongoose.Schema(
  {
    judul: {
      type: String,
      required: [true, "Judul materi wajib diisi"],
      trim: true,
    },
    deskripsi: {
      type: String,
      required: [true, "Deskripsi materi wajib diisi"],
    },
    mataPelajaran: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MataPelajaran",
      required: true,
    },
    kelas: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kelas",
      required: true,
    },
    guru: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    files: [
      {
        fileName: String,
        url: String,
        public_id: String,
        fileType: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    links: [
      {
        title: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index untuk performa query
materiSchema.index({ kelas: 1, mataPelajaran: 1, isPublished: 1 });
materiSchema.index({ guru: 1 });

// Plugin untuk pagination
materiSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Materi", materiSchema);
