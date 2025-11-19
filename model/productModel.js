
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    // categoryId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Category", 
    //   required: true,
    // },
    category: {type: String,required:true},
    description: {
      type: String,
      maxlength: 200, 
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
    
    // brandId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Brand", 
    //   required: true,
    // },

    brand: { 
      type: String, 
      required: true, 
    },
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
