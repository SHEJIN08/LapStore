import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    // 1. Corrected naming and type
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", // Add 'ref' to link to your Category model
      required: true,
    },
    description: {
      type: String,
      maxlength: 200, // This is a good addition!
    },
    images: {
      type: [String],
      required: true,
    },
    // 2. Corrected type
    rating: {
      type: Number,
      required: true,
      default: 0, // A default value is good practice
    },
    // 3. Corrected naming and type
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand", // Add 'ref' to link to your Brand model
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
//Virtual property
productSchema.virtual("variants", {
  ref: "Variant", // The model to use
  localField: "_id", // Find 'Variant' documents where...
  foreignField: "productId", // ...'Variant.productId' matches 'this._id'
});

export default mongoose.model("Product", productSchema); // Changed "product" to "Product" (Mongoose convention)
