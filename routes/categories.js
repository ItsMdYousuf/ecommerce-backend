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
   const categoriesCollection = database.collection("categories");

   // Get all categories
   router.get("/", async (req, res) => {
      try {
         const categories = await categoriesCollection.find({}).toArray();
         res.json(categories);
      } catch (error) {
         res.status(500).json({ error: "Failed to fetch categories" });
      }
   });

   // Create a new category
   router.post("/", upload.single("image"), async (req, res) => {
      try {
         const newCategory = {
            name: req.body.name,
            slug: req.body.slug,
            description: req.body.description,
            image: req.file ? `/uploads/${req.file.filename}` : null,
            createdAt: new Date(),
            updatedAt: new Date(),
         };

         const result = await categoriesCollection.insertOne(newCategory);
         // Fetch the newly inserted category
         const insertedCategory = await categoriesCollection.findOne({
            _id: result.insertedId,
         });
         res.status(201).json(insertedCategory);
      } catch (error) {
         res.status(400).json({ error: "Category creation failed" });
      }
   });

   // Update an existing category
   router.put("/:id", upload.single("image"), async (req, res) => {
      try {
         const updateData = {
            ...req.body,
            updatedAt: new Date(),
         };

         if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
         }

         const result = await categoriesCollection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData }
         );

         if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Category not found" });
         }
         // Fetch the updated category
         const updatedCategory = await categoriesCollection.findOne({
            _id: new ObjectId(req.params.id),
         });
         res.json(updatedCategory);
      } catch (error) {
         res.status(400).json({ error: "Update failed" });
      }
   });

   // Delete a category
   router.delete("/:id", async (req, res) => {
      try {
         const result = await categoriesCollection.deleteOne({
            _id: new ObjectId(req.params.id),
         });
         if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Category not found" });
         }
         res.json({ message: "Category deleted successfully" });
      } catch (error) {
         res.status(400).json({ error: "Deletion failed" });
      }
   });

   return router;
};
