 import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase:true, trim:true },
  password: { type: String, required: true },
  avatar: { type: String,default:'user'},
  isVerified: { type: Boolean, default: false },
  refferalCode: {type: String},
  isActive: {type: String, default: true},
  role: { type:String, default: 'User'}
},
 {timestamps:true}
);

export default mongoose.model("User", userSchema);
