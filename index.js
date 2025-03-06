const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

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

// -------------------
// End of Multer Config
// -------------------

// Async Function to Run Server
async function run() {
   try {
      await client.connect();

      const database = client.db("insertDB");
      const productsCollection = database.collection("collectionProduct");
      const slidersCollection = database.collection("sliders");

      // Serve static files
      app.use(express.static(path.join(__dirname, "public")));
      app.use("/uploads", express.static(uploadDir));

      // Routes
      app.get("/", (req, res) => {
         res.sendFile(path.join(__dirname, "home.html"));
      });

      app.get("/products", async (req, res) => {
         try {
            const products = await productsCollection.find({}).toArray();
            res.json(products);
         } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
         }
      });

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
            res.status(201).json({
               ...result,
               image: newSlider.image,
            });
         } catch (error) {
            console.error(error);
            res.status(400).json({ error: "Bad request" });
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

      // 404 Handler (Should be the last middleware)
      app.use((req, res) => {
         res.status(404).sendFile(path.join(__dirname, "404.html"));
      });

      // Start Server
      app.listen(port, () => {
         console.log(`Server is running at http://localhost:${port}`);
      });

      console.log("Successfully connected to MongoDB!");
   } catch (error) {
      console.error("Connection error:", error);
   }
}

run().catch(console.error);
