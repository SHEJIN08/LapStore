import mongoose  from "mongoose";

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        default: () => Math.floor(100000 + Math.random() * 900000).toString(), // Generates a random 6-digit ID
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderedItems: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Variant',  // Assuming you have a Variant model, otherwise just ObjectId
            required: true
        },
        // We snapshot these details in case the Product is deleted later
        productName: { type: String, required: true }, //productName
        image: { type: String, required: true },
        productStatus: {
            type: String,
            enum: [ "Placed", "Cancelled", "Return Request", "Returned", "Return Rejected"],
            default: "Placed"
        },
        
        returnReason: { type: String, default: null },
        returnComment: { type: String, default: null },

        quantity: { type: Number, required: true },
        price: { type: Number, required: true } // Price at time of purchase
    }],
    totalPrice: { type: Number, required: true }, // Subtotal
    discount: { type: Number, default: 0 },       // Coupon discount
    finalAmount: { type: Number, required: true }, // Amount to be paid
    
    // We embed the address details directly so history remains accurate
    address: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        address1: { type: String, required: true },
         address2: { type: String },
         city: { type: String, required: true },
         state: { type: String, required: true },
         pincode: { type: String, required: true },
         addressType: { type: String, required: true },
    },
    
    paymentMethod: {
        type: String,
        enum: ['COD', 'Razorpay', 'Wallet'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery' ,'Delivered', 'Cancelled', 'Return Request', 'Returned'],
        default: 'Pending'
    },
   
    returnRequest: {
        type: { type: String, enum: ['Refund', 'Replacement'] },
        reason: String,
        comment: String,
        image: { type: String, default: null },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
        requestDate: Date
    },
    cancellationReason: {
        type: String,
        default: null
    },
    invoiceDate: {
        type: Date
    },
    couponCode: {
        type: String,
        default: null
    },

    orderHistory: [{
        status: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        comment: {
            type: String,
            default: ''
        }
    }],
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);