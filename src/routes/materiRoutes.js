// src/routes/materiRoutes.js
const express = require("express");
const router = express.Router();
const createUploader = require("../middleware/uploadMiddleware");

const {
  createMateri,
  getMateri,
  updateMateri,
  deleteMateri,
  togglePublishMateri,
} = require("../controllers/materiController");

const {
  authMiddleware,
  verifyGuru,
  verifyAnyUser,
} = require("../middleware/authMiddleware");

// PERBAIKAN: Memanggil createUploader dengan argumen yang benar
const materiUploader = createUploader(50); // Menggunakan default mimetypes

const parseLinksFromBody = (req, res, next) => {
  if (req.body.links) {
    try {
      req.body.parsedLinks = JSON.parse(req.body.links);
      if (!Array.isArray(req.body.parsedLinks)) {
        return res.status(400).json({
          message:
            "Format 'links' harus berupa array dalam bentuk JSON string.",
        });
      }
    } catch (error) {
      return res.status(400).json({ message: "Format 'links' tidak valid." });
    }
  } else {
    req.body.parsedLinks = [];
  }
  next();
};

router.post(
  "/",
  authMiddleware,
  verifyGuru,
  materiUploader.array("files", 5),
  parseLinksFromBody,
  createMateri
);

router.get("/", authMiddleware, verifyAnyUser, getMateri);
router.put("/:id", authMiddleware, verifyGuru, updateMateri);
router.delete("/:id", authMiddleware, verifyGuru, deleteMateri);

router.patch(
  "/:id/toggle-publish",
  authMiddleware,
  verifyGuru,
  togglePublishMateri
);

module.exports = router;
