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

    // Safely drop legacy unique index userId_1 from workerapplications to allow additional applications
    try {
      const coll = mongoose.connection.db.collection('workerapplications');
      const idxs = await coll.indexes();
      const hasUniqueUserId = idxs.some(i => i.name === 'userId_1' && i.unique);
      if (hasUniqueUserId) {
        await coll.dropIndex('userId_1');
        console.log('Dropped legacy unique index userId_1 from workerapplications');
      }
    } catch (idxErr) {
      // ignore if collection or index doesn't exist
    }
  } catch (err) {
    console.error(`MongoDB connection error to ${uri}:`, err.message);
    throw err;
  }
}
