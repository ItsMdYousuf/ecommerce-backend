const express = require("express");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
   destination: (req, file, cb) => cb(null, UPLOADS_DIR),
   filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substring(2)}${path.extname(file.originalname)}`),
});

const upload = multer({
   storage,
   fileFilter: (req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Only images allowed"), false),
   limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = (db) => {
   const sliders = db.collection("sliders");

   router.get("/", async (req, res) => {
      try {
         const data = await sliders.find().toArray();
         res.json(data);
      } catch (err) {
         res.status(500).json({ error: "Server error" });
      }
   });

   router.post("/", upload.single("sliderImage"), async (req, res) => {
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
      } catch (err) {
         fs.unlink(file.path, () => { });
         res.status(500).json({ error: "Insert failed" });
      }
   });

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