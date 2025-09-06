import mongoose from 'mongoose';
import 'dotenv/config';
const connect = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined in the .env file.");
    }
    
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("Connected to MongoDB");

  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connect;