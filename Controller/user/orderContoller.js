import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";
import Address from "../../model/addressModel.js";
import Cart from "../../model/cartModel.js";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        
        // 1. Get Query Parameters (Filter & Pagination)
        const { status, page } = req.query;

        // 2. Build Query
        let query = { userId: userId };

        // If a specific status is clicked (e.g., ?status=Shipped)
        if (status && status !== 'All') {
            query.status = status;
        }

        // 3. Pagination Setup
        const limit = 3; 
        const currentPage = parseInt(page) || 1;
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        // 4. Fetch Orders from DB
        const orders = await Order.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .skip((currentPage - 1) * limit)
            .limit(limit);

        // 5. Get User Data (for sidebar avatar/name if needed)
        const user = await User.findById(userId);

        // 6. Render View
        res.render("user/ordersPage", {
            user,
            orders,
            currentPage,
            totalPages,
            currentStatus: status || 'All', // To keep the active tab highlighted
            totalOrders
        });

    } catch (error) {
        console.error("Load Orders Error:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false ,message: ResponseMessage.SERVER_ERROR });
    }

}

    const cancelOrder = async (req, res) => {
    try {
      
        const { orderId, reason } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Order not found" });
        }

        if (order.status !== 'Pending' && order.status !== 'Processing') {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Cannot cancel this order" });
        }

        for(const item of order.orderedItems){
            await Variant.findByIdAndUpdate(item.variantId, {
                $inc: {stock: item.quantity }
            })
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason;
        
        // Add to history
        order.orderHistory.push({
            status: 'Cancelled',
            date: new Date(),
            comment: `Cancelled by User. Reason ${reason}`
        });

        await order.save();


        res.status(StatusCode.OK).json({ success: true, message: "Order cancelled successfully" });

    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

const orderDetailedPage = async (req,res) => {
 try {
    const orderId = req.params.orderId

    const orders = await Order.findById(orderId).populate('userId')

    if(!orders){
        return res.render('user/404')
    }

    const user = orders.userId;

    res.render('user/orderDetails', {
        user,
        order: orders
    })
    
 } catch (error) {
    console.error(error);
 }
}

const returnOrder  = async (req,res) => {
    try {
        const {orderId, returnType, reason, comment} = req.body;

        // Handle Image
       
        let imageUrl = null;
        if (req.file) {
            imageUrl =  req.file.secure_url;
        }

        const order = await Order.findById(orderId)

        if(!order){
            return res.status(StatusCode.NOT_FOUND).json({success: false, message: 'Order not found'})
        }

        if(order.status !== 'Delivered'){
            return res.status(StatusCode.NOT_FOUND).json({success: false, message: 'Order is not eligible for return'})
        }

        order.status = 'Return Request';
        order.returnRequest = {
            type: returnType, // 'Refund' or 'Replacement'
            reason: reason,
            comment: comment,
            image: imageUrl,
            status: 'Pending',
            requestDate: new Date()
        };

        order.orderHistory.push({
            status: 'Return Request',
            date: new Date(),
            comment: `User requested ${returnType}: ${reason}`
        });

        await order.save();
        res.status(StatusCode.OK).json({success: true, message: 'Return request successfully submitted'});

    } catch (error) {
        console.error(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(StatusCode.NOT_FOUND).json({success: false, message: 'Order not found'});
        }

        // 1. Create PDF Document
        const doc = new PDFDocument({ margin: 50 });

        // 2. Set Response Headers (Triggers download)
        const filename = `invoice-${order.orderId}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        // 3. Pipe PDF to Response
        doc.pipe(res);

        // --- PDF CONTENT GENERATION ---

        // A. Header
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Order ID: ${order.orderId}`, { align: 'right' });
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'right' });
        doc.moveDown();

        // B. Addresses
        doc.text(`Bill To:`, 50, 150);
        doc.font('Helvetica-Bold').text(order.address.fullName, 50, 165);
        doc.font('Helvetica').text(order.address.address1, 50, 180);
        doc.text(`${order.address.city}, ${order.address.state} ${order.address.pincode}`, 50, 195);
        doc.text(`Phone: ${order.address.phone}`, 50, 210);

        doc.moveDown();
        const tableTop = 250;

        // C. Table Header
        doc.font('Helvetica-Bold');
        doc.text('Item', 50, tableTop);
        doc.text('Quantity', 300, tableTop, { width: 90, align: 'right' });
        doc.text('Price', 400, tableTop, { width: 90, align: 'right' });
        doc.text('Total', 500, tableTop, { width: 90, align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke(); // Line

        // D. Table Rows
        let yPosition = tableTop + 30;
        doc.font('Helvetica');

        order.orderedItems.forEach(item => {
            const totalPrice = item.price * item.quantity;
            
            doc.text(item.productName, 50, yPosition, { width: 250 }); // Truncate long names if needed
            doc.text(item.quantity.toString(), 300, yPosition, { width: 90, align: 'right' });
            doc.text(`$${item.price.toLocaleString()}`, 400, yPosition, { width: 90, align: 'right' });
            doc.text(`$${totalPrice.toLocaleString()}`, 500, yPosition, { width: 90, align: 'right' });
            
            yPosition += 20;
        });

        doc.moveTo(50, yPosition + 10).lineTo(550, yPosition + 10).stroke(); // Bottom Line

        // E. Summary
        const summaryTop = yPosition + 30;
        doc.font('Helvetica-Bold');
        
        doc.text('Subtotal:', 400, summaryTop, { width: 90, align: 'right' });
        doc.text(`$${order.totalPrice.toLocaleString()}`, 500, summaryTop, { width: 90, align: 'right' });

        if (order.discount > 0) {
            doc.text('Discount:', 400, summaryTop + 15, { width: 90, align: 'right' });
            doc.text(`-$${order.discount.toLocaleString()}`, 500, summaryTop + 15, { width: 90, align: 'right' });
        }

        doc.fontSize(12).text('Grand Total:', 400, summaryTop + 35, { width: 90, align: 'right' });
        doc.text(`$${order.finalAmount.toLocaleString()}`, 500, summaryTop + 35, { width: 90, align: 'right' });

        // F. Footer
        doc.fontSize(10).text('Thank you for your business!', 50, 700, { align: 'center', width: 500 });

        // 4. Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Invoice Error:', error);
        res.status(500).send('Error generating invoice');
    }
};

export default {loadOrders, cancelOrder, orderDetailedPage, returnOrder, downloadInvoice};