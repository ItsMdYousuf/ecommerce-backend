const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
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

// -------------------
// Multer Configuration for Vercel (using memory storage)
// -------------------
const storage = multer.memoryStorage(); // Use memory storage instead of diskStorage

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


// NOTE: Since we're using memory storage, there is no persistent "uploads" directory.
// If you need to process the image file and then store it externally, do it here.
// For example, you might upload req.file.buffer to an external storage service.

// Example route for slider upload using memory storage
app.post("/sliders", upload.single("sliderImage"), async (req, res) => {
   try {
      // Here, req.file.buffer holds the image data.
      // You can convert this to a base64 string or directly upload to external storage.
      // For demonstration, let's assume we convert it to a base64 string.
      const imageBase64 = req.file
         ? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
         : null;

      const newSlider = {
         ...req.body,
         image: imageBase64, // Save the base64 image string (or a URL if you uploaded it)
      };

      const database = client.db("insertDB");
      const slidersCollection = database.collection("sliders");
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

// Other endpoints remain largely the same. 
// Make sure to adjust any file system logic (like deleting files) since you're not writing files to disk.

// Async Function to Run Server
async function run() {
   try {
      await client.connect();

      const database = client.db("insertDB");
      const productsCollection = database.collection("collectionProduct");
      const slidersCollection = database.collection("sliders");
      const categoriesCollection = database.collection("categories");

      // Serve home page and public static files
      app.use(express.static(path.join(__dirname, "public")));
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

      app.listen(port, () => {
         console.log(`Server is running at http://localhost:${port}`);
      });

      console.log("Successfully connected to MongoDB!");
   } catch (error) {
      console.error("Connection error:", error);
   }
}

run().catch(console.error);
