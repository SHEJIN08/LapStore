import Order from "../../model/orderModel.js";
import Variant from "../../model/variantModel.js";
import Wallet from "../../model/walletModel.js";
import walletTransactions from "../../model/walletTransactionsModel.js";
import PDFDocument from "pdfkit";

const processRefundToWallet = async (
  userId,
  amount,
  orderId,
  itemDetails = ""
) => {
  // This increases balance and creates the transaction log in one step
  const updatedWallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount } },
    { upsert: true, new: true } // Create wallet if it doesn't exist
  );

  // Log the Transaction with the Wallet ID
  await walletTransactions.create({
    userId,
    walletId: updatedWallet._id,
    amount,
    type: "credit",
    reason: "refund",
    description: `Refund for Cancelled Order/Item #${orderId} ${itemDetails}`,
    date: new Date(),
  });

  return updatedWallet;
};

// --- GET USER ORDERS (Paginated & Search) ---
const getUserOrdersService = async ({
  userId,
  status,
  page = 1,
  search,
  limit = 3,
}) => {
  let query = { userId: userId };

  //  Search Logic
  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$and = [
      {
        $or: [
          { orderId: searchRegex },
          { "orderedItems.productName": searchRegex },
        ],
      },
    ];
  }

  // Status Filter
  if (status && status !== "All") {
    query.status = status;
  }

  //  Pagination
  const currentPage = parseInt(page);
  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip((currentPage - 1) * limit)
    .limit(limit);

  orders.forEach((order) => {
    order.finalAmount = Math.round(order.finalAmount);
    order.totalPrice = Math.round(order.totalPrice);
  });

  return { orders, totalOrders, totalPages, currentPage };
};

// --- GET SINGLE ORDER DETAILS ---
const getOrderByIdService = async (orderId) => {
  const order = await Order.findById(orderId).populate("userId");
  if (!order) throw new Error("Order not found");
  return order;
};

// --- CANCEL ORDER (Item or Full) ---
const cancelOrderService = async ({ orderId, itemId, reason }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  const TAX_RATE = 0.05;
  const SHIPPING_THRESHOLD = 100000;
  const SHIPPING_FEE = 100;

  // --- CASE A: PARTIAL CANCEL (Specific Item) ---
  if (itemId) {
    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found");

    if (
      item.productStatus === "Cancelled" ||
      item.productStatus === "Delivered"
    ) {
      throw new Error("Item cannot be cancelled");
    }

    // 1. Restock
    await Variant.findByIdAndUpdate(item.variantId, {
      $inc: { stock: item.quantity },
    });

    // 2. Identify if this is the last item
    const activeItemsBeforeCancel = order.orderedItems.filter(
      (i) => i.productStatus !== "Cancelled"
    );
    const isLastItem = activeItemsBeforeCancel.length === 1;

    // 3. Calculate Item Values
    const itemSubtotal = item.price * item.quantity;
    const itemTax = Math.round(itemSubtotal * TAX_RATE);

    // 4. Financials (Refund Logic)
    if (order.paymentStatus === "Paid") {
      let refundAmount = itemSubtotal + itemTax;

      // If it's the last item, we MUST refund the shipping fee too
      if (isLastItem && order.totalPrice < SHIPPING_THRESHOLD) {
        refundAmount += SHIPPING_FEE;
      }

      await processRefundToWallet(
        order.userId,
        Math.round(refundAmount),
        order.orderId,
        `(${item.productName})`
      );
    }

    // 5. Update the Order Document
    item.productStatus = "Cancelled";

    const activeItemsAfterCancel = order.orderedItems.filter(
      (i) => i.productStatus !== "Cancelled"
    );

    // Only recalculate and overwrite the price if there are ACTIVE items left.
    if (activeItemsAfterCancel.length > 0) {
      const newSubtotal = activeItemsAfterCancel.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );
      const newTax = Math.round(newSubtotal * TAX_RATE);
      const newShipping =
        newSubtotal > 0 && newSubtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;

      order.totalPrice = newSubtotal;
      order.finalAmount = Math.max(
        0,
        newSubtotal + newTax + newShipping - (order.discount || 0)
      );
    }

    // Check if Order is Fully Cancelled
    if (activeItemsAfterCancel.length === 0) {
      order.status = "Cancelled";
      order.cancellationReason = "All items cancelled individually";
    } else {
      order.orderHistory.push({
        status: "Item Cancelled",
        date: new Date(),
        comment: `Item ${item.productName} cancelled. Reason: ${
          reason || "User Request"
        }`,
      });
    }

    await order.save();
    return "Item cancelled successfully";
  }

  // --- CASE B: FULL ORDER CANCEL ---
  else {
    if (order.status !== "Pending" && order.status !== "Processing") {
      throw new Error("Cannot cancel this order at this stage");
    }

    // Restock All
    for (const item of order.orderedItems) {
      if (item.productStatus !== "Cancelled") {
        await Variant.findByIdAndUpdate(item.variantId, {
          $inc: { stock: item.quantity },
        });
        item.productStatus = "Cancelled";
      }
    }

    // Refund All
    if (order.paymentStatus === "Paid") {
      await processRefundToWallet(
        order.userId,
        order.finalAmount,
        order.orderId,
        "(Full Order)"
      );
      order.paymentStatus = "Refunded";
    }

    //  Update Status
    order.status = "Cancelled";
    order.cancellationReason = reason;

    order.orderHistory.push({
      status: "Cancelled",
      date: new Date(),
      comment: `Order Cancelled. Reason: ${reason}`,
    });

    await order.save();
    return "Order cancelled successfully";
  }
};

// --- RETURN ORDER (Item or Full) ---
const returnOrderService = async ({
  orderId,
  itemId,
  returnType,
  reason,
  comment,
  imageUrl,
}) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // --- CASE A: SINGLE ITEM RETURN ---
  if (itemId && itemId !== "null" && itemId !== "") {
    const item = order.orderedItems.id(itemId);
    if (!item) throw new Error("Item not found in order");

    item.productStatus = "Return Request";
    item.returnReason = reason;
    item.returnComment = comment;

    order.orderHistory.push({
      status: "Return Request",
      date: new Date(),
      comment: `Item Return: ${item.productName} - ${reason}`,
    });
  }
  // --- CASE B: WHOLE ORDER RETURN ---
  else {
    order.status = "Return Request";
    order.returnRequest = {
      type: returnType,
      reason: reason,
      comment: comment,
      image: imageUrl,
      status: "Pending",
      requestDate: new Date(),
    };

    order.orderedItems.forEach((item) => {
      if (["Delivered", "Placed", "Shipped"].includes(item.productStatus)) {
        item.productStatus = "Return Request";
        item.returnReason = reason;
        item.returnComment = comment;
      }
    });

    order.orderHistory.push({
      status: "Return Request",
      date: new Date(),
      comment: `Order Return: ${reason}`,
    });
  }

  await order.save();
  return "Return request submitted successfully";
};

const generateInvoiceService = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  // Only include items that are NOT cancelled
  const activeItems = order.orderedItems.filter(
    (item) => item.productStatus !== "Cancelled"
  );

  const doc = new PDFDocument({ margin: 50 });
  const filename = `invoice-${order.orderId}.pdf`;

  // --- PDF CONTENT ---
  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();

  doc.fontSize(10).text(`Order ID: ${order.orderId}`, { align: "right" });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, {
    align: "right",
  });
  doc.moveDown();

  doc.text(`Bill To:`, 50, 150);
  doc.font("Helvetica-Bold").text(order.address.fullName, 50, 165);
  doc.font("Helvetica").text(order.address.address1, 50, 180);
  doc.text(
    `${order.address.city}, ${order.address.state} ${order.address.pincode}`,
    50,
    195
  );
  doc.text(`Phone: ${order.address.phone}`, 50, 210);

  const tableTop = 250;
  doc.font("Helvetica-Bold");
  doc.text("Item", 50, tableTop);
  doc.text("Quantity", 300, tableTop, { width: 90, align: "right" });
  doc.text("Price", 400, tableTop, { width: 90, align: "right" });
  doc.text("Total", 500, tableTop, { width: 90, align: "right" });

  doc
    .moveTo(50, tableTop + 15)
    .lineTo(590, tableTop + 15)
    .stroke();

  let yPosition = tableTop + 30;
  let recalculatedSubtotal = 0; // Track subtotal of non-cancelled items
  doc.font("Helvetica");

  // ---  RENDER FILTERED ITEMS ---
  activeItems.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    recalculatedSubtotal += itemTotal;

    const productName =
      item.productName.length > 40
        ? item.productName.substring(0, 37) + "..."
        : item.productName;

    doc.text(productName, 50, yPosition, { width: 250 });
    doc.text(item.quantity.toString(), 300, yPosition, {
      width: 90,
      align: "right",
    });
    doc.text(`Rs.${item.price.toLocaleString()}`, 400, yPosition, {
      width: 90,
      align: "right",
    });
    doc.text(`Rs.${itemTotal.toLocaleString()}`, 500, yPosition, {
      width: 90,
      align: "right",
    });

    yPosition += 20;
  });

  doc
    .moveTo(50, yPosition + 10)
    .lineTo(590, yPosition + 10)
    .stroke();

  let currentY = yPosition + 30;
  doc.font("Helvetica-Bold");

  // ---  SUMMARY CALCULATIONS ---
  // Subtotal
  doc.text("Subtotal:", 400, currentY, { width: 90, align: "right" });
  doc
    .font("Helvetica")
    .text(`Rs.${recalculatedSubtotal.toLocaleString()}`, 500, currentY, {
      width: 90,
      align: "right",
    });

  // Tax (5% of recalculated subtotal)
  currentY += 15;
  const taxAmount = Math.round(recalculatedSubtotal * 0.05);
  doc
    .font("Helvetica-Bold")
    .text("Tax (5%):", 400, currentY, { width: 90, align: "right" });
  doc
    .font("Helvetica")
    .text(`Rs.${taxAmount.toLocaleString()}`, 500, currentY, {
      width: 90,
      align: "right",
    });

  // Shipping
  currentY += 15;
  const shippingFee =
    recalculatedSubtotal < 100000 && recalculatedSubtotal > 0 ? 100 : 0;
  doc
    .font("Helvetica-Bold")
    .text("Shipping:", 400, currentY, { width: 90, align: "right" });
  doc
    .font("Helvetica")
    .text(`Rs.${shippingFee.toLocaleString()}`, 500, currentY, {
      width: 90,
      align: "right",
    });

  // Discount (Use existing order discount)
  if (order.discount > 0) {
    currentY += 15;
    doc
      .font("Helvetica-Bold")
      .text("Discount:", 400, currentY, { width: 90, align: "right" });
    doc
      .font("Helvetica")
      .text(`-Rs.${order.discount.toLocaleString()}`, 500, currentY, {
        width: 90,
        align: "right",
      });
  }

  // Grand Total (Note: This should match your DB finalAmount if handled correctly during cancellation)
  currentY += 25;
  const finalDisplayTotal =
    recalculatedSubtotal + taxAmount + shippingFee - (order.discount || 0);

  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Grand Total:", 400, currentY, { width: 90, align: "right" });
  doc.text(
    `Rs.${Math.max(0, finalDisplayTotal).toLocaleString()}`,
    500,
    currentY,
    { width: 90, align: "right" }
  );

  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Thank you for your business!", 50, 700, {
      align: "center",
      width: 500,
    });

  doc.end();
  return { doc, filename };
};

export default {
  getUserOrdersService,
  getOrderByIdService,
  cancelOrderService,
  returnOrderService,
  generateInvoiceService,
};
