import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";
import Address from "../../model/addressModel.js";
import Cart from "../../model/cartModel.js";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadOrders = async (req, res) => {
  try {
    const { status, page, search } = req.query;
    const userId = req.session.user;

    let query = { userId: userId };

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

    if (status && status !== "All") {
      query.status = status;
    }

    const limit = 3;
    const currentPage = parseInt(page) || 1;
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    const user = await User.findById(userId);

    res.render("user/ordersPage", {
      user,
      orders,
      currentPage,
      totalPages,
      currentSearch: search || "",
      currentStatus: status || "All",
      totalOrders,
    });
  } catch (error) {
    console.error("Load Orders Error:", error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;

    // 1. Fetch Order
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    // Constants for Recalculation (if needed)
    const TAX_RATE = 0.05;
    const SHIPPING_THRESHOLD = 100000;
    const SHIPPING_FEE = 100;

    // ====================================================
    // SCENARIO A: CANCEL SPECIFIC ITEM (Partial Cancel)
    // ====================================================
    if (itemId) {
      const item = order.orderedItems.id(itemId);
      if (!item)
        return res
          .status(StatusCode.NOT_FOUND)
          .json({ success: false, message: "Item not found" });

      // Validation
      if (
        item.productStatus === "Cancelled" ||
        item.productStatus === "Delivered"
      ) {
        return res
          .status(StatusCode.BAD_REQUEST)
          .json({ success: false, message: "Item cannot be cancelled" });
      }

      // A1. Restock Variant
      await Variant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity },
      });

      // A2. Calculate Refund Amount for this Item
      const itemBasePrice = item.price * item.quantity;
      const priceAfterTax = itemBasePrice + itemBasePrice * TAX_RATE;
      const shippingRefund = priceAfterTax > 100000 ? 0 : 100;

      const refundAmount = priceAfterTax + shippingRefund;
      // A3. Handle Financials based on Payment Method
      if (order.paymentStatus === "Paid") {
        // For PAID orders: Refund to Wallet, DO NOT change order total
        // await Wallet.addMoney(order.userId, refundAmount, `Refund for ${item.productName}`);

        console.log(`Refunded ₹${refundAmount} to Wallet`);
      } else if (order.paymentMethod === "COD") {
        // For COD: Reduce the amount the user has to pay
        let newTotalPrice = Math.max(0, order.totalPrice - refundAmount);
        let newTax = Math.round(newTotalPrice * TAX_RATE);

        // Recalculate Shipping
        let newShippingFee = 0;
        if (newTotalPrice > 0 && newTotalPrice < SHIPPING_THRESHOLD) {
          newShippingFee = SHIPPING_FEE;
        }

        // Update Order Totals
        order.totalPrice = newTotalPrice;
        order.finalAmount =
          newTotalPrice + newTax + newShippingFee - (order.discount || 0);
        if (order.finalAmount < 0) order.finalAmount = 0;
      }

      // A4. Mark Item as Cancelled
      item.productStatus = "Cancelled";

      // A5. Check if *ALL* items are now cancelled
      const allCancelled = order.orderedItems.every(
        (i) => i.productStatus === "Cancelled"
      );
      if (allCancelled) {
        order.status = "Cancelled";
        order.cancellationReason = "All items cancelled individually";
        if (order.paymentMethod === "COD") order.finalAmount = 0;
      } else {
        // Add history log for single item
        order.orderHistory.push({
          status: "Item Cancelled",
          date: new Date(),
          comment: `Item ${item.productName} cancelled. Reason: ${
            reason || "User Request"
          }`,
        });
      }
    }

    // ====================================================
    // SCENARIO B: CANCEL ENTIRE ORDER
    // ====================================================
    else {
      if (order.status !== "Pending" && order.status !== "Processing") {
        return res
          .status(StatusCode.BAD_REQUEST)
          .json({
            success: false,
            message: "Cannot cancel this order at this stage",
          });
      }

      // B1. Loop through items to Restock & Cancel
      for (const item of order.orderedItems) {
        if (item.productStatus !== "Cancelled") {
          // Restock
          await Variant.findByIdAndUpdate(item.variantId, {
            $inc: { stock: item.quantity },
          });
          // Update Status
          item.productStatus = "Cancelled";
        }
      }

      // B2. Handle Full Refund (If Paid)
      if (order.paymentStatus === "Paid") {
        // Refund the entire finalAmount
        // await Wallet.addMoney(order.userId, order.finalAmount, `Refund for Order #${order.orderId}`);
        const refundAmount = order.finalAmount;
        console.log(`Refunded Full Amount ₹${order.finalAmount} to Wallet`);
        order.paymentStatus = "Refunded";
      }

      // B3. Update Order Status
      order.status = "Cancelled";
      order.cancellationReason = reason;

      // For COD, final amount becomes 0 as nothing is delivered
      if (order.paymentMethod === "COD") {
        order.finalAmount = 0;
      }

      order.orderHistory.push({
        status: "Cancelled",
        date: new Date(),
        comment: `Order Cancelled. Reason: ${reason}`,
      });
    }

    // 3. Save Changes
    await order.save();

    res.status(StatusCode.OK).json({
      success: true,
      message: itemId
        ? "Item cancelled successfully"
        : "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel Error:", error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Server Error" });
  }
};

const orderDetailedPage = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const orders = await Order.findById(orderId).populate("userId");

    if (!orders) {
      return res.render("user/StatusCode.NOT_FOUND");
    }

    const user = orders.userId;

    res.render("user/orderDetails", {
      user,
      order: orders,
    });
  } catch (error) {
    console.error(error);
  }
};

const returnOrder = async (req, res) => {
  try {
    const { orderId, itemId, returnType, reason, comment } = req.body;

    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.secure_url;
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    // --- CASE A: SINGLE ITEM RETURN ---
    if (itemId && itemId !== "null" && itemId !== "") {
      const item = order.orderedItems.id(itemId);

      if (!item) {
        return res
          .status(StatusCode.NOT_FOUND)
          .json({ success: false, message: "Item not found in order" });
      }

      // Update the specific ITEM status
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
      // CASE B: Whole Order Return
      order.status = "Return Request";
      order.returnRequest = {
        type: returnType,
        reason: reason,
        comment: comment,
        image: imageUrl,
        status: "Pending",
        requestDate: new Date(),
      };

      // FIX: Update items even if they are just "Placed" or "Delivered"
      order.orderedItems.forEach((item) => {
        // Check for both 'Delivered' AND 'Placed'
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

    res.status(StatusCode.OK).json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error("Return Error:", error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    // 1. Create PDF Document
    const doc = new PDFDocument({ margin: 50 });

    const filename = `invoice-${order.orderId}.pdf`;
    res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-type", "application/pdf");

    doc.pipe(res);

    // --- PDF CONTENT GENERATION ---

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

    doc.moveDown();
    const tableTop = 250;

    doc.font("Helvetica-Bold");
    doc.text("Item", 50, tableTop);
    doc.text("Quantity", 300, tableTop, { width: 90, align: "right" });
    doc.text("Price", 400, tableTop, { width: 90, align: "right" });
    doc.text("Total", StatusCode.INTERNAL_SERVER_ERROR, tableTop, {
      width: 90,
      align: "right",
    });

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke(); // Line

    let yPosition = tableTop + 30;
    doc.font("Helvetica");

    order.orderedItems.forEach((item) => {
      const totalPrice = item.price * item.quantity;

      doc.text(item.productName, 50, yPosition, { width: 250 }); // Truncate long names if needed
      doc.text(item.quantity.toString(), 300, yPosition, {
        width: 90,
        align: "right",
      });
      doc.text(`$${item.price.toLocaleString()}`, 400, yPosition, {
        width: 90,
        align: "right",
      });
      doc.text(
        `$${totalPrice.toLocaleString()}`,
        StatusCode.INTERNAL_SERVER_ERROR,
        yPosition,
        {
          width: 90,
          align: "right",
        }
      );

      yPosition += 20;
    });

    doc
      .moveTo(50, yPosition + 10)
      .lineTo(550, yPosition + 10)
      .stroke(); // Bottom Line

    const summaryTop = yPosition + 30;
    doc.font("Helvetica-Bold");

    doc.text("Subtotal:", 400, summaryTop, { width: 90, align: "right" });
    doc.text(
      `$${order.totalPrice.toLocaleString()}`,
      StatusCode.INTERNAL_SERVER_ERROR,
      summaryTop,
      {
        width: 90,
        align: "right",
      }
    );

    if (order.discount > 0) {
      doc.text("Discount:", 400, summaryTop + 15, {
        width: 90,
        align: "right",
      });
      doc.text(
        `-$${order.discount.toLocaleString()}`,
        StatusCode.INTERNAL_SERVER_ERROR,
        summaryTop + 15,
        {
          width: 90,
          align: "right",
        }
      );
    }

    doc.fontSize(12).text("Grand Total:", 400, summaryTop + 35, {
      width: 90,
      align: "right",
    });
    doc.text(
      `$${order.finalAmount.toLocaleString()}`,
      StatusCode.INTERNAL_SERVER_ERROR,
      summaryTop + 35,
      {
        width: 90,
        align: "right",
      }
    );

    doc.fontSize(10).text("Thank you for your business!", 50, 700, {
      align: "center",
      width: StatusCode.INTERNAL_SERVER_ERROR,
    });

    doc.end();
  } catch (error) {
    console.error("Invoice Error:", error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

export default {
  loadOrders,
  cancelOrder,
  orderDetailedPage,
  returnOrder,
  downloadInvoice,
};
