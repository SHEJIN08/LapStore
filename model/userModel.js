 import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: {type: String, required: true, unique: true},
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase:true, trim:true },
  password: { type: String, required: false },
  avatar: { type: String,default:'/images/user/defaultUser.jpg'},
  isVerified: { type: Boolean, default: false },
  referralCode: {type: String, unique: true},
  redeemed: {type: Boolean, default: false},
  isActive: {type: Boolean, default: true},
  role: { type:String, default: 'User'}
},
 {timestamps:true}
);

export default mongoose.model("User", userSchema);
