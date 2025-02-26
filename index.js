const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();


// set the view engine to ejs
app.set('view engine', 'ejs');

// Middleware
app.use(cors());
app.use(express.json());

// Use environment variables in production for sensitive data
const uri = `mongodb+srv://onlineokk:dcZScy5J0vgl66Wh@ecommerce-sercer.t7lnc.mongodb.net/?retryWrites=true&w=majority&appName=ecommerce-sercer`;

// Create a MongoClient with options to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

// -------------------
// Multer configuration
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

// File filter to only allow images
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
// End of Multer config
// -------------------

async function run() {
   try {
      // Connect the client to the server
      await client.connect();

      // Get database and collection references
      const database = client.db("insertDB");
      const productsCollection = database.collection("collectionProduct");
      const slidersCollection = database.collection("sliders");

      // Serve static files from the 'public' directory
      app.use(express.static(path.join(__dirname, "public")));


      app.get('/', (req, res) => {
         res.render('home', { name: 'Home Page' });
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

      // Get all slider images
      app.get("/sliders", async (req, res) => {
         try {
            const sliders = await slidersCollection.find({}).toArray();
            res.json(sliders);
         } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
         }
      });

      // Endpoint for slider image upload
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

      // Single endpoint for product creation with image upload
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

      // Serve static files from the 'uploads' directory
      app.use("/uploads", express.static(path.join(__dirname, "uploads")));

      // Start server
      app.listen(port, () => {
         console.log(`Server is running at http://localhost:${port}`);
      });

      console.log("Successfully connected to MongoDB!");
   } catch (error) {
      console.error("Connection error:", error);
   }
}

run();
