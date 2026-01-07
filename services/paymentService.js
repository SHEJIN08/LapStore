// services/paymentService.js
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// Initialize Razorpay Instance
const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create Razorpay Order (For the Popup)
const createRazorpayOrderService = async (amount) => {
  const options = {
    amount: Math.round(amount * 100), // Convert Rupee to Paisa
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  };

  return await instance.orders.create(options);
};

// 2. Verify Signature (Security Check)
const verifySignatureService = (
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  // Generate the expected signature using HMAC SHA256
  const generated_signature = crypto
    .createHmac("sha256", secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  // Compare with the signature sent by Razorpay
  return generated_signature === razorpay_signature;
};

export default {
  createRazorpayOrderService,
  verifySignatureService,
};
