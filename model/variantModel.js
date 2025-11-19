import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
    // This links the variant back to the main product
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // Links to the 'Product' model
        required: true
    },
    ram: {
        type: String,
        required: true
    },
    storage: {
        type: String,
        required: true
    },
    color: {
        type: String,
       default: "Standard"
    },
    graphics: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    }
});

export default mongoose.model("Variant", variantSchema);