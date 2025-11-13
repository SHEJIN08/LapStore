import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true , lowercase: true , trim:true },
  password: { type: String, required: true },
  role: {type: String, default: 'Admin'}
},
 {timestamps:true}
); 
export default mongoose.model("Admin", adminSchema);