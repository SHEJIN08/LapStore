import orderService from "../../services/user/orderService.js";
import User from "../../model/userModel.js";
import mongoose from "mongoose";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

// --- LOAD ORDERS PAGE ---
const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    const { status, page, search } = req.query;

    const data = await orderService.getUserOrdersService({
        userId,
        status,
        page,
        search
    });

    const user = await User.findById(userId);

    res.render("user/ordersPage", {
      user,
      orders: data.orders,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      currentSearch: search || "",
      currentStatus: status || "All",
      totalOrders: data.totalOrders,
    });
  } catch (error) {
    console.error("Load Orders Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// --- ORDER DETAILS PAGE ---
const orderDetailedPage = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        res.render('user/404'); 
    }
    
    const order = await orderService.getOrderByIdService(orderId);
    // Note: service populates userId, so we can access user data from order.userId
    const user = order.userId; 

    res.render("user/orderDetails", { user, order });

  } catch (error) {
    if (error.message === "Order not found") {
        return res.render("user/404"); 
    }
    console.error(error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};

// --- CANCEL ORDER ---
const cancelOrder = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;

    const message = await orderService.cancelOrderService({ orderId, itemId, reason });

    res.status(StatusCode.OK).json({ success: true, message });

  } catch (error) {
    // Handle Known Logic Errors
    if (error.message === "Order not found" || error.message === "Item not found") {
        return res.status(StatusCode.NOT_FOUND).json({ success: false, message: error.message });
    }
    if (error.message === "Item cannot be cancelled" || error.message.includes("Cannot cancel")) {
        return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }

    console.error("Cancel Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server Error" });
  }
};

// --- RETURN ORDER ---
const returnOrder = async (req, res) => {
  try {
    const { orderId, itemId, returnType, reason, comment } = req.body;
    
    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.secure_url;
    }

    const message = await orderService.returnOrderService({
        orderId, itemId, returnType, reason, comment, imageUrl
    });

    res.status(StatusCode.OK).json({ success: true, message });

  } catch (error) {
    if (error.message.includes("not found")) {
        return res.status(StatusCode.NOT_FOUND).json({ success: false, message: error.message });
    }
    console.error("Return Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// --- DOWNLOAD INVOICE ---
const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // 1. Call Service to get PDF Stream
        const { doc, filename } = await orderService.generateInvoiceService(orderId);

        // 2. Set Headers for Download
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/pdf");

        // 3. Pipe the PDF document directly to the response
        doc.pipe(res);

    } catch (error) {
        console.error("Invoice Download Error:", error);
        
        if (error.message === "Order not found") {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        
        res.status(500).json({ success: false, message: "Failed to generate invoice" });
    }
};

export default {
  loadOrders,
  cancelOrder,
  orderDetailedPage,
  returnOrder,
  downloadInvoice,
};