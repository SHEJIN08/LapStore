import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({

},{timestamps: true})

export default mongoose.model('Coupon',couponSchema)