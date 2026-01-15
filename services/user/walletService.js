import Razorpay from "razorpay";
import crypto from "crypto";
import Wallet from "../../model/walletModel.js";
import walletTransactions from "../../model/walletTransactionsModel.js";
import dotenv from "dotenv";
dotenv.config();

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getWalletData = async (userId, page = 1, filter = "all") => {
  const limit = 5;
  const skip = (page - 1) * limit;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0 });
    await wallet.save();
  }

  let query = { walletId: wallet._id };

  if (filter === "credit" || filter === "debit") {
    query.type = filter;
  }

  const transactions = await walletTransactions
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalTransactions = await walletTransactions.countDocuments(query);
  const totalPages = Math.ceil(totalTransactions / limit);

  return { wallet, transactions, totalPages, currentPage: page };
};

const initiateAddMoney = async (amount) => {
  const options = {
    amount: amount * 100, // Convert to paise
    currency: "INR",
    receipt: "wallet_recharge_" + Date.now(),
  };

  const order = await instance.orders.create(options);
  return order;
};

// ---  VERIFY & CREDIT WALLET  ---
const verifyAndCreditWallet = async (
  userId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
) => {
  // 1. Verify Signature
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const generated_signature = crypto
    .createHmac("sha256", secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature !== razorpay_signature) {
    throw new Error("Payment signature verification failed");
  }

  // 2. Fetch Order to get exact amount (Secure)
  const order = await instance.orders.fetch(razorpay_order_id);
  const amountInRupees = order.amount / 100;

  // 3. Update Wallet Balance
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0 });
  }

  wallet.balance += amountInRupees;
  await wallet.save();

  // 4. Record Transaction
  const transaction = new walletTransactions({
    userId: userId,
    walletId: wallet._id,
    amount: amountInRupees,
    type: "credit",
    reason: "top-up",
    description: "Wallet Recharge via Razorpay",
  });

  await transaction.save();

  return { success: true, newBalance: wallet.balance };
};

const processWalletPayment = async (userId, amount, orderId) => {
  try {
    const wallet = await Wallet.findOne({ userId });

    // 1. Check Balance
    if (!wallet || wallet.balance < amount) {
      return { success: false, message: "Insufficient wallet balance" };
    }

    // 2. Deduct Amount
    wallet.balance -= amount;
    await wallet.save();

    // 3. Record Transaction
    const transaction = new walletTransactions({
      userId: userId,
      walletId: wallet._id,
      orderId: orderId, // Link to the order
      amount: amount,
      type: "debit",
      reason: "order_payment",
      description: `Payment for Order #${orderId
        .toString()
        .slice(-6)
        .toUpperCase()}`,
    });

    await transaction.save();

    return { success: true };
  } catch (error) {
    throw new Error(error.message);
  }
};

export default {
  getWalletData,
  initiateAddMoney,
  verifyAndCreditWallet,
  processWalletPayment,
};
