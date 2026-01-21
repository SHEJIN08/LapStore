import Order from "../../model/orderModel.js";
import Wallet from "../../model/walletModel.js";
import walletTransactions from "../../model/walletTransactionsModel.js";
import Variant from "../../model/variantModel.js";

// --- GET ALL ORDERS (Filter, Search, Pagination) ---
const getAllOrdersService = async ({
  startDate,
  endDate,
  search,
  status,
  page = 1,
  limit = 4,
}) => {
  const skip = (page - 1) * limit;
  let query = {};

  // 1. Date Filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // 2. Status Filter
  const validStatuses = [
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
    "Return Request",
    "Returned",
    "Return Rejected",
  ];
  if (validStatuses.includes(status)) {
    query.status = status;
  }

  // 3. Search Filter
  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [{ orderId: searchRegex }, { "address.fullName": searchRegex }];
  }

  // 4. Fetch Data
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  return { orders, totalOrders, totalPages };
};

// --- GET SINGLE ORDER ---
const getOrderByIdService = async (orderId) => {
  const order = await Order.findById(orderId).populate("userId");
  if (!order) throw new Error("Order not found");
  return order;
};

// --- UPDATE ORDER STATUS ---
const updateOrderStatusService = async (orderId, status) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  order.status = status;

  if (status === "Delivered") {
    order.orderedItems.forEach((item) => {
      if (
        item.productStatus !== "Cancelled" &&
        item.productStatus !== "Returned"
      ) {
        item.productStatus = "Delivered";
      }
    });

    if (order.paymentMethod === "COD") {
      order.paymentStatus = "Paid";
    }
  }
  // If Order is Cancelled, mark items Cancelled
  else if (status === "Cancelled") {
    order.orderedItems.forEach((item) => {
      item.productStatus = "Cancelled";
    });
  }

  order.orderHistory.push({
    status: status,
    date: new Date(),
    comment: `Status updated to ${status} by Admin`,
  });

  await order.save();
  return order;
};

// --- HANDLE RETURN REQUEST ---
const processReturnRequestService = async ({ orderId, itemId, action }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  let wallet = await Wallet.findOne({ userId: order.userId });

  if (!wallet) {
    wallet = new Wallet({ userId: order.userId, balance: 0 });

    await wallet.save();
  }

  const TAX_RATE = 0.05;
  const CONVENIENCE_FEE = 30;

  // --- OPTION 1: Handle Specific Item Return ---
  if (itemId) {
    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found");

    order.status = "Return Request";

    if (action === "approve") {
      item.productStatus = "Return Approved";
    } else if (action === "reject") {
      item.productStatus = "Return Rejected";
    } else if (action === "mark_received") {
      if (item.productStatus === "Returned") return true;

      // Calculate Refund
      const itemBasePrice = item.price * item.quantity;
      const priceAfterTax = itemBasePrice + itemBasePrice * TAX_RATE;
      // FIX: Only refund shipping if this is the LAST active item in the order
      const activeItems = order.orderedItems.filter((p) =>
        [
          "Placed",
          "Processing",
          "Shipped",
          "Delivered",
          "Return Request",
          "Return Approved",
        ].includes(p.productStatus)
      );

      // If this is the only item left, refund the shipping too. Otherwise 0.
      let shippingRefund = 0;
      if (activeItems.length <= 1) {
        shippingRefund = order.finalAmount > 100000 ? 0 : 100;
      }
      const refundAmount = Math.max(
        0,
        priceAfterTax + shippingRefund - CONVENIENCE_FEE
      );

      item.productStatus = "Returned";

      await Variant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity },
      });

      // TODO: Wallet Logic
      wallet.balance += refundAmount;
      await wallet.save();

      await walletTransactions.create({
        userId: wallet.userId,
        walletId: wallet._id,
        amount: refundAmount,
        type: "credit",
        reason: "refund",
        description: `Refund for item: ${item.productName}`,
      });
    }
  }

  // --- OPTION 2: Handle Whole Order Return ---
  else {
    if (action === "approve") {
      order.status = "Return Approved";

      order.orderedItems.forEach((item) => {
        if (
          item.productStatus === "Return Request" ||
          item.productStatus === "Delivered"
        ) {
          item.productStatus = "Return Approved";
        }
      });
    } else if (action === "reject") {
      order.status = "Return Rejected";
      if (order.returnRequest) order.returnRequest.status = "Rejected";

      // Reset pending items to Delivered/Rejected as needed
      order.orderedItems.forEach((p) => {
        if (p.productStatus === "Return Request")
          p.productStatus = "Return Rejected";
      });
    } else if (action === "mark_received") {
      order.status = "Returned";
      if (order.returnRequest) order.returnRequest.status = "Approved";

      let totalRefundableAmount = 0;

      for (const item of order.orderedItems) {
        // FIX: Skip items that are already Cancelled or Returned to prevent double stocking
        if (
          ["Returned", "Cancelled", "Return Rejected"].includes(
            item.productStatus
          )
        ) {
          continue;
        }

        // Update Status
        item.productStatus = "Returned";

        // Update Stock
        await Variant.findByIdAndUpdate(item.variantId, {
          $inc: { stock: item.quantity },
        });

        // Calculate Item Value for Refund
        const itemTotal = item.price * item.quantity * (1 + TAX_RATE);
        totalRefundableAmount += itemTotal;
      }

      // Add Shipping logic for whole order
      const shippingFee = order.finalAmount > 100000 ? 0 : 1000;
      const finalRefund = Math.max(
        0,
        totalRefundableAmount + shippingFee - CONVENIENCE_FEE
      );

      // Update Wallet
      wallet.balance += finalRefund;
      await wallet.save();

      await walletTransactions.create({
        userId: wallet.userId,
        walletId: wallet._id,
        amount: finalRefund,
        type: "credit",
        reason: "refund",
        description: "Full Order Refund processed",
      });
    }
  }

  // --- SYNC MAIN ORDER STATUS ---
  order.markModified("orderedItems");

  const itemStatuses = order.orderedItems.map((item) => item.productStatus);

  // 1. Check if ANY item is currently in a return process (Request or Approved)
  const isReturnActive = itemStatuses.some((status) => 
    ["Return Request", "Return Approved"].includes(status)
  );

  // 2. Check other conditions
  const allReturned = itemStatuses.every((status) => status === "Returned");
  const allCancelledOrReturned = itemStatuses.every((status) =>
    ["Returned", "Cancelled", "Return Rejected"].includes(status)
  );

  const hasActiveItems = order.orderedItems.some((item) =>
    [
      "Placed",
      "Processing",
      "Shipped",
      "Out for Delivery",
      "Delivered",
    ].includes(item.productStatus)
  );

  // --- LOGIC UPDATE ---
  if (isReturnActive) {
    // If any item is being returned, keep the main status as Return Request
    order.status = "Return Request"; 
  } else if (allReturned) {
    order.status = "Returned";
    if (order.returnRequest) order.returnRequest.status = "Approved";
  } else if (hasActiveItems) {
    // Only set back to normal statuses if NO returns are active
    if (itemStatuses.includes("Delivered")) {
      order.status = "Delivered";
    } else if (itemStatuses.includes("Shipped")) {
      order.status = "Shipped";
    } else {
      order.status = "Processing";
    }
  } else if (allCancelledOrReturned) {
    if (itemStatuses.includes("Returned")) {
      order.status = "Returned";
    } else {
      order.status = "Return Rejected";
    }
  }

  await order.save();
  return true;
};

export default {
  getAllOrdersService,
  getOrderByIdService,
  updateOrderStatusService,
  processReturnRequestService,
};
