// routes/sliders.js
const express = require("express");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// -------------------
// Multer Configuration
// -------------------
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      cb(null, "uploads/");
   },
   filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
   },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
   if (file.mimetype.startsWith("image/")) {
      cb(null, true);
   } else {
      cb(new Error("Only image files are allowed!"), false);
   }
};

const upload = multer({
   storage: storage,
   fileFilter: fileFilter,
   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// -------------------
// End of Multer Config
// -------------------

module.exports = (database) => {
   const slidersCollection = database.collection("sliders");

   // Get all sliders
   router.get("/", async (req, res) => {
      try {
         const sliders = await slidersCollection.find({}).toArray();
         res.json(sliders);
      } catch (error) {
         console.error(error);
         res.status(500).json({ error: "Internal server error" });
      }
   });

   // Upload slider image and create slider
   router.post("/", upload.single("sliderImage"), async (req, res) => {
      try {
         const newSlider = {
            ...req.body,
            image: req.file ? `/uploads/${req.file.filename}` : null,
         };
         const result = await slidersCollection.insertOne(newSlider);
         // Fetch the newly inserted document
         const insertedSlider = await slidersCollection.findOne({
            _id: result.insertedId,
         });
         res.status(201).json(insertedSlider);
      } catch (error) {
         console.error("Slider upload error:", error);
         res.status(400).json({ error: error.message || "Bad request" });
      }
   });

   // Delete a slider
   router.delete("/:id", async (req, res) => {
      try {
         const slider = await slidersCollection.findOne({
            _id: new ObjectId(req.params.id),
         });

         if (!slider)
            return res.status(404).json({ error: "Slider not found" });

         // Delete associated image file correctly
         if (slider.image) {
            const filename = path.basename(slider.image); // Get filename from URL
            const imagePath = path.join(__dirname, 'uploads', filename); // Corrected path
            fs.unlink(imagePath, (err) => {
               if (err) console.error("Error deleting image:", err);
            });
         }

         const result = await slidersCollection.deleteOne({
            _id: new ObjectId(req.params.id),
         });

         if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Slider not found" });
         }

         res.json({ message: "Slider deleted successfully" });
      } catch (error) {
         console.error("Delete error:", error);
         res.status(500).json({ error: "Internal server error" });
      }
   });

   return router;
};
