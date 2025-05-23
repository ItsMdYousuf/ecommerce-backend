// Backend slider server.
const express = require("express");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Define the absolute path to the uploads directory.
// process.cwd() gives the current working directory from where the Node.js process was launched.
// This is generally more reliable for finding project root directories in production.
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure the uploads directory exists when the server starts.
// The { recursive: true } option ensures parent directories are created if they don't exist.
if (!fs.existsSync(UPLOADS_DIR)) {
   fs.mkdirSync(UPLOADS_DIR, { recursive: true });
   console.log(`Created uploads directory at: ${UPLOADS_DIR}`);
}

// -------------------
// Multer Configuration
// -------------------
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      // Use the absolute path for the destination.
      cb(null, UPLOADS_DIR);
   },
   filename: (req, file, cb) => {
      // Generate a unique filename to prevent conflicts.
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
   },
});

// File filter to accept only image files.
const fileFilter = (req, file, cb) => {
   if (file.mimetype.startsWith("image/")) {
      cb(null, true); // Accept the file
   } else {
      // Reject the file with an error message for better feedback.
      cb(new Error("Only image files are allowed!"), false);
   }
};

const upload = multer({
   storage: storage,
   fileFilter: fileFilter,
   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
});

// -------------------
// End of Multer Config
// -------------------

module.exports = (database) => {
   const slidersCollection = database.collection("sliders");

   // GET /sliders - Get all sliders
   router.get("/", async (req, res) => {
      try {
         const sliders = await slidersCollection.find({}).toArray();
         res.json(sliders);
      } catch (error) {
         console.error("Fetch sliders error:", error);
         res.status(500).json({ error: "Internal server error" });
      }
   });

   // POST /sliders - Upload slider image and create slider entry
   router.post("/", upload.single("sliderImage"), async (req, res) => {
      try {
         // Check if a file was uploaded.
         if (!req.file) {
            return res.status(400).json({ error: "Image file is required" });
         }
         // Check if title is provided.
         if (!req.body.title) {
            // If title is missing, delete the already uploaded file to prevent orphaned files.
            fs.unlink(req.file.path, (err) => {
               if (err) console.error("Error deleting orphaned file:", err);
            });
            return res.status(400).json({ error: "Title is required" });
         }

         const newSlider = {
            title: req.body.title,
            // Store the path relative to the static serve directory (e.g., /uploads/filename.jpg).
            image: `/uploads/${req.file.filename}`,
         };

         const result = await slidersCollection.insertOne(newSlider);

         // Fetch the newly inserted document to return it with its generated _id.
         const insertedSlider = await slidersCollection.findOne({
            _id: result.insertedId,
         });
         res.status(201).json(insertedSlider);
      } catch (error) {
         console.error("Slider upload error:", error);
         // Handle Multer-specific errors (e.g., file size limit, invalid file type).
         if (error instanceof multer.MulterError) {
            return res.status(400).json({ error: error.message });
         }
         // If any other error occurred after file upload but before DB insertion, delete the file.
         if (req.file) {
            fs.unlink(req.file.path, (err) => {
               if (err) console.error("Error deleting uploaded file on error:", err);
            });
         }
         res.status(500).json({ error: "Internal server error" }); // General server error
      }
   });

   // DELETE /sliders/:id - Delete a slider and its associated image file
   router.delete("/:id", async (req, res) => {
      try {
         const sliderId = req.params.id;
         // Validate the MongoDB ObjectId.
         if (!ObjectId.isValid(sliderId)) {
            return res.status(400).json({ error: "Invalid slider ID" });
         }

         const slider = await slidersCollection.findOne({
            _id: new ObjectId(sliderId),
         });

         if (!slider) {
            return res.status(404).json({ error: "Slider not found" });
         }

         // Delete the associated image file from the file system.
         if (slider.image) {
            // Extract the filename from the stored image path (e.g., remove '/uploads/').
            const filename = path.basename(slider.image); // path.basename is safer than string replace
            // Construct the absolute path to the image file.
            const imagePath = path.join(UPLOADS_DIR, filename);

            fs.unlink(imagePath, (err) => {
               if (err) {
                  console.error("Error deleting image file:", err);
                  // Log the error but don't prevent DB deletion if file deletion fails.
                  // This ensures the database remains consistent even if the file system operation fails.
               } else {
                  console.log(`Successfully deleted image: ${imagePath}`);
               }
            });
         }

         // Delete the slider entry from the database.
         const result = await slidersCollection.deleteOne({
            _id: new ObjectId(sliderId),
         });

         if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Slider not found" }); // This is mostly redundant due to the check above but safe.
         }

         res.json({ message: "Slider deleted successfully" });
      } catch (error) {
         console.error("Delete error:", error);
         res.status(500).json({ error: "Internal server error" });
      }
   });

   return router;
};