 import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: {type: String, required: true, unique: true},
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase:true, trim:true },
  password: { type: String, required: true },
  avatar: { type: String,default:'user'},
  phone: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  refferalCode: {type: String},
  isActive: {type: Boolean, default: true},
  role: { type:String, default: 'User'}
},
 {timestamps:true}
);

export default mongoose.model("User", userSchema);
