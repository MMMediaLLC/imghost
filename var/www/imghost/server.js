import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables (useful if they run it locally with .env)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Load password from environment variable
let password = process.env.IMGHOST_PASSWORD;

// Graceful fallback for development so the app does not crash
if (!password) {
  console.warn("WARNING: IMGHOST_PASSWORD environment variable is not set. Defaulting to 'admin' for development.");
  password = 'admin';
}

const uploadsDir = '/var/www/imghost/uploads';

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up static files serving for uploaded images
app.use('/uploads', express.static(uploadsDir));

// Serve uploader frontend from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  }
});

// Configure Multer file filter to restrict formats
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only jpg, jpeg, png, gif, and webp formats are supported.'), false);
  }
};

// Configure Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB max size
});

// Middleware for authentication check
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // The client will send the password directly in the Authorization header
  if (authHeader !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  next();
};

// POST: Verify password endpoint
app.post('/verify', (req, res) => {
  const { password: enteredPassword } = req.body;
  if (!enteredPassword) {
    return res.status(400).json({ error: 'Password is required' });
  }
  if (enteredPassword === password) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

// POST: Upload single image
app.post('/upload', authenticate, (req, res) => {
  const uploadSingle = upload.single('image');

  uploadSingle(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size is 20MB.' });
      }
      return res.status(400).json({ error: `Multer upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    // Generate accurate static URL using the requesting host
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.json({
      success: true,
      filename: req.file.filename,
      url: url
    });
  });
});

// GET: Retrieve last 20 uploaded images
app.get('/images', authenticate, (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Could not inspect uploads directory.' });
    }

    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    const imageFiles = files
      .filter(file => allowedExtensions.includes(path.extname(file).toLowerCase()))
      .map(file => {
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            url: `${hostUrl}/uploads/${file}`,
            mtime: stats.mtimeMs
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    // Sort descending by modified time (mtime)
    imageFiles.sort((a, b) => b.mtime - a.mtime);

    // Limit to the last 20 images
    const last20 = imageFiles.slice(0, 20).map(img => ({
      filename: img.filename,
      url: img.url
    }));

    res.json({ images: last20 });
  });
});

// Serve frontend SPA uploader on all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle errors gracefully
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Port configuration
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Serving static uploads from ${uploadsDir}`);
});
