import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base upload directory
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Ensure subdirectories exist
const PROBLEM_DIR = path.join(UPLOADS_DIR, 'problem-photos');
const COMPLETION_DIR = path.join(UPLOADS_DIR, 'completion-photos');

[UPLOADS_DIR, PROBLEM_DIR, COMPLETION_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage for problem photos
const problemStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PROBLEM_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `problem-${uniqueSuffix}${ext}`);
  }
});

// Configure storage for completion photos
const completionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, COMPLETION_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `completion-${uniqueSuffix}${ext}`);
  }
});

// File filter: only JPG, JPEG, PNG, WEBP
const imageFileFilter = (_req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, PNG, and WEBP image formats are supported.'), false);
  }
};

// Max 5 MB per image, max 5 images
export const uploadProblemPhotos = multer({
  storage: problemStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5
  },
  fileFilter: imageFileFilter
}).array('photos', 5);

export const uploadCompletionPhotos = multer({
  storage: completionStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5
  },
  fileFilter: imageFileFilter
}).array('photos', 5);
