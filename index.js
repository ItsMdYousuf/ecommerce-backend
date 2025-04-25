const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
   origin: '*',
   methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
   preflightContinue: false,
   optionsSuccessStatus: 204
}));

// Parse JSON bodies
app.use(express.json());

// Ensure 'uploads' directory exists and serve it statically
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
   fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Serve public assets
app.use(express.static(path.join(__dirname, 'public')));

// Environment validation
const uri = process.env.NEW_URL;
if (!uri) {
   console.error('Error: Missing MongoDB connection string (NEW_URL) in .env');
   process.exit(1);
}

// MongoDB client
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

async function startServer() {
   try {
      // Connect to MongoDB
      await client.connect();
      console.log('Successfully connected to MongoDB');

      const db = client.db('insertDB');

      // Register routes with injected database
      app.use('/products', require('./routes/products')(db));
      app.use('/orders', require('./routes/orders')(db));
      app.use('/sliders', require('./routes/sliders')(db));
      // app.use('/categories', require('./routes/categories')(db));
      const categoriesRouter = require('./routes/categories.js');
      app.use('/categories', categoriesRouter(db));
      // Home route
      app.get('/', (req, res) => {
         res.sendFile(path.join(__dirname, 'public', './home.html'));
      });

      // Start listening
      app.listen(port, () => {
         console.log(`Server is running at http://localhost:${port}`);
      });

   } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
   }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
   console.log('\nGracefully shutting down');
   await client.close();
   process.exit(0);
});
