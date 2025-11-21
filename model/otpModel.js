import mongoose  from "mongoose";

const otpVerificationSchema = new mongoose.Schema({
    userId: {type: String},
    email: {type: String, required: true},
    otpCode: {type: String, required:true},
    isUsed: {type: Boolean, default:false},
 createdAt: { type: Date, default: Date.now, expires: 120 } 
})

export default mongoose.model('UserOtpVerification',otpVerificationSchema)  