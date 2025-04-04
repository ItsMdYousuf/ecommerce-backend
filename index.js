const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const serverless = require("serverless-http");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = process.env.NEW_URL;
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
   fs.mkdirSync(uploadDir);
}

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

// Serve static files for uploaded images
app.use("/uploads", express.static(uploadDir));

// Async function to set up routes after connecting to MongoDB
async function run() {
   try {
      await client.connect();
      const database = client.db("insertDB");
      const productsCollection = database.collection("collectionProduct");
      const slidersCollection = database.collection("sliders");
      const categoriesCollection = database.collection("categories");

      // Serve home page and public static files (if needed)
      app.use(express.static(path.join(__dirname, "public")));
      app.get("/", (req, res) => {
         res.sendFile(path.join(__dirname, "home.html"));
      });

      // Get all products
      app.get("/products", async (req, res) => {
         try {
            const products = await productsCollection.find({}).toArray();
            res.json(products);
         } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
         }
      });

      // Get all sliders
      app.get("/sliders", async (req, res) => {
         try {
            const sliders = await slidersCollection.find({}).toArray();
            res.json(sliders);
         } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
         }
      });

      // Upload Slider Image
      app.post("/sliders", upload.single("sliderImage"), async (req, res) => {
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

      // Delete slider endpoint
      app.delete("/sliders/:id", async (req, res) => {
         try {
            const slider = await slidersCollection.findOne({
               _id: new ObjectId(req.params.id),
            });

            if (!slider)
               return res.status(404).json({ error: "Slider not found" });

            // Delete associated image file if it exists
            if (slider.image) {
               const filename = path.basename(slider.image); // Get filename from URL
               const imagePath = path.join(uploadDir, filename);
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

      // Upload Product Image
      app.post("/products", upload.single("productImage"), async (req, res) => {
         try {
            const newProduct = {
               ...req.body,
               image: req.file ? `/uploads/${req.file.filename}` : null,
            };

            const result = await productsCollection.insertOne(newProduct);
            res.status(201).json({
               ...result,
               image: newProduct.image,
            });
         } catch (error) {
            console.error(error);
            res.status(400).json({ error: "Bad request" });
         }
      });

      // Delete a product
      app.delete("/products/:id", async (req, res) => {
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

      // Product manage actions (example using PATCH)
      app.patch("/:id", async (req, res) => {
         try {
            // Note: MongoDB's native driver does not have findByIdAndUpdate.
            // Use findOneAndUpdate instead.
            const result = await productsCollection.findOneAndUpdate(
               { _id: new ObjectId(req.params.id) },
               { $set: { status: req.body.status } },
               { returnDocument: "after" }
            );
            res.json(result.value);
         } catch (err) {
            res.status(400).json({ message: err.message });
         }
      });

      // Get a single product
      app.get("/products/:id", async (req, res) => {
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
      app.patch("/products/bulk", async (req, res) => {
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

      // Category CRUD Endpoints

      // Get all categories
      app.get("/categories", async (req, res) => {
         try {
            const categories = await categoriesCollection.find({}).toArray();
            res.json(categories);
         } catch (error) {
            res.status(500).json({ error: "Failed to fetch categories" });
         }
      });

      // Create a new category
      app.post("/categories", upload.single("image"), async (req, res) => {
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
            res.status(201).json({
               ...newCategory,
               _id: result.insertedId,
            });
         } catch (error) {
            res.status(400).json({ error: "Category creation failed" });
         }
      });

      // Update a category
      app.put("/categories/:id", upload.single("image"), async (req, res) => {
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
            res.json({ message: "Category updated successfully" });
         } catch (error) {
            res.status(400).json({ error: "Update failed" });
         }
      });

      // Delete a category
      app.delete("/categories/:id", async (req, res) => {
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

      console.log("Successfully connected to MongoDB and routes are set up! http://localhost:5000");
   } catch (error) {
      console.error("Connection error:", error);
   }
}

// Initialize the connection and routes
run().catch(console.error);

if (require.main === module) {
   const port = process.env.PORT || 5000;
   app.listen(port, () =>
      console.log(`Server is running on http://localhost:${port}`)
   );
}

// Export the Express app wrapped in serverless-http for Vercel
module.exports = serverless(app);
