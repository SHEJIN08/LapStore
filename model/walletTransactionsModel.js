import mongoose from "mongoose";

const walletTransactionsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true
  },
  orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null // Optional: Null for "top-up", required for "order_payment"
    },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit']
  },
  reason: {
    type: String,
    enum: ['top-up','refund','order_payment','withdraw','referral_bonus']
  },
  description: {
        type: String,
        default: '' 
  }
},
{timestamps: true}
);

export default mongoose.model('walletTransactions', walletTransactionsSchema)