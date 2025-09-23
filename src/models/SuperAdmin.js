// models/SuperAdmin.js
const mongoose = require("mongoose");

const superAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    identifier: { type: String, required: true, unique: true }, // ID Super Admin
    password: { type: String, required: true },
    role: {
      type: String,
      default: "super_admin",
    },
    isActive: { type: Boolean, default: true },
    isPasswordDefault: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
