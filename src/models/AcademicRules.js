// src/models/AcademicRules.js
const mongoose = require("mongoose");

const academicRulesSchema = new mongoose.Schema({
  key: {
    type: String,
    default: "global-rules",
    unique: true,
  },
  // Aturan Kenaikan Kelas
  promotion: {
    minAttendancePercentage: {
      type: Number,
      default: 80,
      min: 0,
      max: 100,
    },
    maxSubjectsBelowPassingGrade: {
      type: Number,
      default: 3,
      min: 0,
    },
    passingGrade: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
  },
  // Anda bisa menambahkan aturan lain di masa depan
  // Misalnya: aturan kelulusan, aturan ranking, dll.
});

// Fungsi statis untuk mendapatkan atau membuat aturan default
academicRulesSchema.statics.getRules = async function () {
  let rules = await this.findOne({ key: "global-rules" });
  if (!rules) {
    rules = await this.create({});
  }
  return rules;
};

module.exports = mongoose.model("AcademicRules", academicRulesSchema);
