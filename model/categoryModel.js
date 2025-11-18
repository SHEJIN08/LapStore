import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  isListed: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);