import Order from "../../model/orderModel.js";
import Variant from "../../model/variantModel.js";
import PDFDocument from "pdfkit";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET USER ORDERS (Paginated & Search) ---
const getUserOrdersService = async ({ userId, status, page = 1, search, limit = 3 }) => {
    let query = { userId: userId };

    // 1. Search Logic
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

    // 2. Status Filter
    if (status && status !== "All") {
        query.status = status;
    }

    // 3. Pagination
    const currentPage = parseInt(page);
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit);

        orders.forEach(order => {
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

        if (item.productStatus === "Cancelled" || item.productStatus === "Delivered") {
            throw new Error("Item cannot be cancelled");
        }

        // 1. Restock
        await Variant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });

        // 2. Calculate Refund
        const itemBasePrice = item.price * item.quantity;
        const priceAfterTax = itemBasePrice + (itemBasePrice * TAX_RATE);
        const shippingRefund = priceAfterTax > 100000 ? 0 : 100;
        const refundAmount = priceAfterTax + shippingRefund;

        // 3. Financials
        if (order.paymentStatus === "Paid") {
            // Refund Logic (Wallet) would go here
            console.log(`Refunded ₹${refundAmount} to Wallet`);
        } else if (order.paymentMethod === "COD") {
            let newTotalPrice = Math.max(0, order.totalPrice - refundAmount);
            let newTax = Math.round(newTotalPrice * TAX_RATE);
            let newShippingFee = (newTotalPrice > 0 && newTotalPrice < SHIPPING_THRESHOLD) ? SHIPPING_FEE : 0;

            order.totalPrice = newTotalPrice;
            order.finalAmount = Math.max(0, newTotalPrice + newTax + newShippingFee - (order.discount || 0));
        }

        item.productStatus = "Cancelled";

        // 4. Check if Order is Fully Cancelled
        const allCancelled = order.orderedItems.every(i => i.productStatus === "Cancelled");
        if (allCancelled) {
            order.status = "Cancelled";
            order.cancellationReason = "All items cancelled individually";
            if (order.paymentMethod === "COD") order.finalAmount = 0;
        } else {
            order.orderHistory.push({
                status: "Item Cancelled",
                date: new Date(),
                comment: `Item ${item.productName} cancelled. Reason: ${reason || "User Request"}`
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

        // 1. Restock All
        for (const item of order.orderedItems) {
            if (item.productStatus !== "Cancelled") {
                await Variant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
                item.productStatus = "Cancelled";
            }
        }

        // 2. Refund All
        if (order.paymentStatus === "Paid") {
            console.log(`Refunded Full Amount ₹${order.finalAmount} to Wallet`);
            order.paymentStatus = "Refunded";
        }

        // 3. Update Status
        order.status = "Cancelled";
        order.cancellationReason = reason;
        if (order.paymentMethod === "COD") order.finalAmount = 0;

        order.orderHistory.push({
            status: "Cancelled",
            date: new Date(),
            comment: `Order Cancelled. Reason: ${reason}`
        });

        await order.save();
        return "Order cancelled successfully";
    }
};

// --- RETURN ORDER (Item or Full) ---
const returnOrderService = async ({ orderId, itemId, returnType, reason, comment, imageUrl }) => {
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

    const doc = new PDFDocument({ margin: 50 });
    const filename = `invoice-${order.orderId}.pdf`;
    res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-type", "application/pdf");

    
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
        return { doc, filename };

    } 

    export default {
    getUserOrdersService,
    getOrderByIdService,
    cancelOrderService,
    returnOrderService,
    generateInvoiceService
};