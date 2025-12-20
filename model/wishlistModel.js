import mongoose from "mongoose";


const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
items: [
    {
        productId: {
                 type: mongoose.Schema.Types.ObjectId,
                 ref: 'Product',
                 required: true
        },
        variantId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Variant',
                required: true
            },
        addedAt: {
                type: Date,
                default: Date.now
            }
    },
]
},
{timestamps: true}
)

export default mongoose.model('Wishlist', wishlistSchema);