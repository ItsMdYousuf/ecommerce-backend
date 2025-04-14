// index.js - Main entry point
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

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
app.use("/uploads", express.static(uploadDir)); // Serve static files

// Import route modules
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const sliderRoutes = require("./routes/sliders");
const categoryRoutes = require("./routes/categories");

async function run() {
   try {
      await client.connect();
      const database = client.db("insertDB");

      // Pass the database object to route modules
      app.use("/products", productRoutes(database));
      app.use("/orders", orderRoutes(database));
      app.use("/sliders", sliderRoutes(database));
      app.use("/categories", categoryRoutes(database));

      // Serve static files for the home page
      app.use(express.static(path.join(__dirname, "public")));
      app.get("/", (req, res) => {
         res.sendFile(path.join(__dirname, "home.html"));
      });

      console.log("Successfully connected to MongoDB!");
   } catch (error) {
      console.error("Connection error:", error);
   }
}

// Run database connection and setup
run().catch(console.error);

// If running locally, start the server
if (process.env.NODE_ENV !== "production") {
   app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
   });
}

// Export the Express app as the default export
module.exports = app;
