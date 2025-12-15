import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  addressType: { type: String, enum: ["Home", "Work", "Other"] },
   userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  address1: { type: String, required: true },
  address2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default:'India' },
  isDefault: { type: Boolean, default: false },
});

export default mongoose.model("Address", addressSchema);
