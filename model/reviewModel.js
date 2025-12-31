import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        // variantId: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: 'Variant',
        //     required: true
        // },
        rating: {
            type: Number,
            default: 0,
            required: true,
        },
        comment: {
            type: String,
            required: true
        }
    },
    {timestamps: true},
)

export default mongoose.model('Review', reviewSchema);