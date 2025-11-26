import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { createRequire } from "module";

// Initialize 'require'
const require = createRequire(import.meta.url);

// --- FIX: THE SAFETY CHAIN ---
// We load the library into a temporary variable first
const multerStorageCloudinary = require("multer-storage-cloudinary");

// We try to find the class in the two most common places. 
// If the first one is undefined, it falls back to the second.
const CloudinaryStorage = multerStorageCloudinary.CloudinaryStorage || multerStorageCloudinary;
// -----------------------------

// Load environment variables
dotenv.config();

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configure Cloud Storage
const storage = new CloudinaryStorage({
   cloudinary: { v2: cloudinary },
  params: {
    folder: "ecommerce-uploads",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

// 3. Initialize Multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."), false);
    }
  },
});

export default upload;