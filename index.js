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
   serverSelectionTimeoutMS: 5000, // Fail fast on connection
   connectTimeoutMS: 5000,
});

// Database references
let database, productsCollection, slidersCollection, categoriesCollection;

async function connectDB() {
   if (!client.topology?.isConnected()) {
      await client.connect();
      database = client.db("insertDB");
      productsCollection = database.collection("collectionProduct");
      slidersCollection = database.collection("sliders");
      categoriesCollection = database.collection("categories");
   }
}

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
   fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Configuration
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      cb(null, "uploads/");
   },
   filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
   },
});

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
   limits: { fileSize: 5 * 1024 * 1024 },
});

// Serve static files
app.use("/uploads", express.static(uploadDir));

// Routes
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
   res.sendFile(path.join(__dirname, "home.html"));
});

// Products routes
app.get("/products", async (req, res) => {
   try {
      await connectDB();
      const products = await productsCollection.find({}).toArray();
      res.json(products);
   } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
   }
});

app.post("/products", upload.single("productImage"), async (req, res) => {
   try {
      await connectDB();
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

// Sliders routes
app.get("/sliders", async (req, res) => {
   try {
      await connectDB();
      const sliders = await slidersCollection.find({}).toArray();
      res.json(sliders);
   } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
   }
});

app.post("/sliders", upload.single("sliderImage"), async (req, res) => {
   try {
      await connectDB();
      const newSlider = {
         ...req.body,
         image: req.file ? `/uploads/${req.file.filename}` : null,
      };

      const result = await slidersCollection.insertOne(newSlider);
      const insertedSlider = await slidersCollection.findOne({
         _id: result.insertedId,
      });
      res.status(201).json(insertedSlider);
   } catch (error) {
      console.error("Slider upload error:", error);
      res.status(400).json({ error: error.message || "Bad request" });
   }
});

// Categories routes
app.get("/categories", async (req, res) => {
   try {
      await connectDB();
      const categories = await categoriesCollection.find({}).toArray();
      res.json(categories);
   } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
   }
});

// Other routes (delete, update, etc.) follow the same pattern...

// Error handling middleware
app.use((err, req, res, next) => {
   console.error(err.stack);
   res.status(500).json({ error: "Something went wrong!" });
});

// Serverless handler
module.exports.handler = async (event, context) => {
   context.callbackWaitsForEmptyEventLoop = false;
   return serverless(app)(event, context);
};

// Local server
if (require.main === module) {
   const port = process.env.PORT || 5000;
   app.listen(port, () =>
      console.log(`Server running on http://localhost:${port}`)
   );
}