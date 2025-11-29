
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", 
      required: true,
    },
    images: {
      type: [String],
      required: true,
    },
      rating: {
      type: Number,
      required: true,
      default: 0, 
    },
    description: {
      type: String,
      required: true
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand", 
      required: true,
    },
    productOffer: { 
      type: Number, default: 0
    },
    specifications: [
      {
            key: { type: String, required: true },
            value: { type: String, required: true }
        }
      ],
    isPublished: { type: Boolean, default: true }
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

export default mongoose.model("Product", productSchema); 
