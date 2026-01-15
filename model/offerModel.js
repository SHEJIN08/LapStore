import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    offerType: {
      type: String,
      enum: ["product", "category"],
      required: true,
    },
    offerName: {
      type: String,
      required: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

offerSchema.pre("validate", function (next) {
  if (this.endDate < this.startDate) {
    next(new Error("End date must be after start date"));
  } else {
    next();
  }
});

// 2. Ensure Percentage discount doesn't exceed 100
offerSchema.pre("save", function (next) {
  if (this.discountType === "percentage" && this.discountValue > 100) {
    next(new Error("Percentage discount cannot exceed 100%"));
  } else {
    next();
  }
});

offerSchema.pre("save", function (next) {
  if (this.offerType === "category" && !this.categoryId) {
    next(new Error("Category offers require a categoryId"));
  } else if (
    this.offerType === "product" &&
    (!this.productIds || this.productIds.length === 0)
  ) {
    next(new Error("Product offers require at least one productId"));
  } else {
    next();
  }
});

export default mongoose.model("Offer", offerSchema);
