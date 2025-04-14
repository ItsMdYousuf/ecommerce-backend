// index.js - Main entry point
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();

// Middleware
const corsConfig = {
   origin: "*",
   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
   preflightContinue: false,
   optionsSuccessStatus: 204,
};

app.use(cors(corsConfig));
app.use(express.json());

// MongoDB Connection
const uri = process.env.MONGODB_URI; // Use MONGODB_URI for Vercel
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

let db; // Store the database connection

async function connectToDatabase() {
   try {
      if (!db) {
         await client.connect();
         db = client.db("insertDB"); //  Use your database name
         console.log("Successfully connected to MongoDB!");
      }
      return db;
   } catch (error) {
      console.error("Database connection error:", error);
      throw error; // Important: rethrow the error to be caught by the caller
   }
}

// Ensure 'uploads' directory exists (Vercel doesn't persist files)
//  Vercel doesn't support writing to the local filesystem.  You'll need a cloud storage solution
//  like AWS S3, Google Cloud Storage, or Cloudinary.  For this example, I'll REMOVE local file handling.
// const uploadDir = path.join(__dirname, "uploads");
// if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir);
// }
// app.use("/uploads", express.static(uploadDir)); // Serve static files - REMOVED

// Import route modules and pass the database connection function
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const sliderRoutes = require("./routes/sliders");
const categoryRoutes = require("./routes/categories");

app.use(async (req, res, next) => {
   try {
      const database = await connectToDatabase();
      // Pass database connection to routes
      req.db = database;
      next();
   } catch (error) {
      // Handle connection errors
      res.status(500).json({ error: "Failed to connect to database" });
   }
});

app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/sliders", sliderRoutes);
app.use("/categories", categoryRoutes);

// Serve static files for the home page.  Vercel recommends placing static assets
//  in a 'public' directory at the root of your project.
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
   res.sendFile(path.join(__dirname, "public", "home.html")); //  Adjust path if needed
});

//  Vercel will automatically assign a port, so we don't need to specify it.
//  The following code is NOT needed for Vercel.  Remove the port definition and listen.
// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//     console.log(`Server is running at http://localhost:${port}`);
// });

// Export the Express app as the default export.  This is essential for Vercel.
module.exports = app;
