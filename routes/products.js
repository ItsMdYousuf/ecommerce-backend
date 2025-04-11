// routes/products.js
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
   const productsCollection = database.collection("collectionProduct");

   // Get all products
   router.get("/", async (req, res) => {
      try {
         const products = await productsCollection.find({}).toArray();
         res.json(products);
      } catch (error) {
         console.error(error);
         res.status(500).json({ error: "Internal server error" });
      }
   });

   // Upload product image and create product
   router.post("/", upload.single("productImage"), async (req, res) => {
      try {
         const newProduct = {
            ...req.body,
            image: req.file ? `/uploads/${req.file.filename}` : null,
         };
         const result = await productsCollection.insertOne(newProduct);
         // Fetch the newly inserted document
         const insertedProduct = await productsCollection.findOne({
            _id: result.insertedId,
         });
         res.status(201).json(insertedProduct);
      } catch (error) {
         console.error(error);
         res.status(400).json({ error: "Bad request" });
      }
   });

   // Delete a product
   router.delete("/:id", async (req, res) => {
      try {
         const result = await productsCollection.deleteOne({
            _id: new ObjectId(req.params.id),
         });
         if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Product not found" });
         }
         res.json({ message: "Product deleted successfully" });
      } catch (error) {
         res.status(400).json({ error: "Deletion failed" });
      }
   });

   // Update product status
   router.patch("/:id", async (req, res) => {
      try {
         const result = await productsCollection.findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: req.body.status } },
            { returnDocument: 'after' } // returns the updated document
         );
         if (!result.value) {
            return res.status(404).json({ message: "Product not found" });
         }
         res.json(result.value);
      } catch (err) {
         res.status(400).json({ message: err.message });
      }
   });

   // Get a single product
   router.get("/:id", async (req, res) => {
      try {
         const product = await productsCollection.findOne({
            _id: new ObjectId(req.params.id),
         });
         if (!product) {
            return res.status(404).json({ error: "Product not found" });
         }
         res.json(product);
      } catch (error) {
         res.status(400).json({ error: "Failed to fetch product" });
      }
   });

   // Bulk update products
   router.patch("/bulk", async (req, res) => {
      try {
         const { ids, status } = req.body;
         const objectIds = ids.map((id) => new ObjectId(id));

         const result = await productsCollection.updateMany(
            { _id: { $in: objectIds } },
            { $set: { status: status } }
         );

         res.json({
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
         });
      } catch (error) {
         res.status(400).json({ error: "Bulk update failed" });
      }
   });

   return router;
};
