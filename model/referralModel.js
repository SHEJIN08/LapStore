import mongoose from "mongoose";

const refferalSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // The person who shared the code
    },
    refereeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // The new person who joined
    },
    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },
    referralAmount: {
      type: Number,
      required: true,
      default: 100,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Referral", refferalSchema);
