import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable in .env');
}

const client = new MongoClient(uri);

let dbInstance = null;

export async function connectDB() {
  if (dbInstance) return dbInstance;
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas (Native Driver)');
    dbInstance = client.db('zenox_protocol_db');
    return dbInstance;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
}

export function getDB() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return dbInstance;
}






