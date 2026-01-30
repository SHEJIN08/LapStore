import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minLength: 4,
      maxLength: 15,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: 0,
    },
    minPurchaseAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    usageLimitPerUser: {
      type: Number,
      default: 1,
      min: 1,
    },
    totalUsageLimit: {
      type: Number,
      default: 0,
    },
    currentUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    userEligibility: {
      type: String,
      enum: ["all", "specific"],
      default: "all",
    },
    specificUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isListed: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// --- 🛡️ Validations ---

// 1. Ensure End Date is after Start Date
couponSchema.pre("validate", function (next) {
  if (this.endDate < this.startDate) {
    next(new Error("End date must be after start date"));
  } else {
    next();
  }
});

// 2. Ensure Percentage discount doesn't exceed 100
couponSchema.pre("save", function (next) {
  if (this.type === "percentage" && this.discountValue > 60) {
    next(new Error("Percentage discount cannot exceed 60%"));
  } else {
    next();
  }
});

export default mongoose.model("Coupon", couponSchema);
