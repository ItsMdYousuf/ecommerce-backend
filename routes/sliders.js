const express = require("express");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage configuration
const storage = multer.diskStorage({
   destination: (_, __, cb) => cb(null, UPLOADS_DIR),
   filename: (_, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
   },
});

// Multer middleware with validation
const upload = multer({
   storage,
   fileFilter: (_, file, cb) => {
      file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Only images allowed"));
   },
   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = (db) => {
   const sliders = db.collection("sliders");

   // Get all sliders
   router.get("/", async (_, res) => {
      try {
         const data = await sliders.find().toArray();
         res.json(data);
      } catch {
         res.status(500).json({ error: "Server error" });
      }
   });

   // Create new slider
   router.post("/", upload.single("image"), async (req, res) => {
      const { file, body: { title } } = req;
      if (!file || !title) {
         if (file) fs.unlink(file.path, () => { });
         return res.status(400).json({ error: "Title and image are required" });
      }

      const slider = { title, image: `/uploads/${file.filename}` };
      try {
         const result = await sliders.insertOne(slider);
         const created = await sliders.findOne({ _id: result.insertedId });
         res.status(201).json(created);
      } catch {
         fs.unlink(file.path, () => { });
         res.status(500).json({ error: "Insert failed" });
      }
   });

   // Delete slider by ID
   router.delete("/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

      const slider = await sliders.findOne({ _id: new ObjectId(id) });
      if (!slider) return res.status(404).json({ error: "Slider not found" });

      if (slider.image) {
         const filePath = path.join(UPLOADS_DIR, path.basename(slider.image));
         fs.unlink(filePath, () => { });
      }

      await sliders.deleteOne({ _id: new ObjectId(id) });
      res.json({ message: "Deleted" });
   });

   return router;
};
