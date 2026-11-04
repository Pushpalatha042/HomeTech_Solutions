import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hometech';
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${uri}`);
  } catch (err) {
    console.error(`MongoDB connection error to ${uri}:`, err.message);
    throw err;
  }
}
