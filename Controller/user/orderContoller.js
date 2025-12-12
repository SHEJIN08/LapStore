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
        const limit = 5; // Show 5 orders per page
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
      
        const { orderId } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Order not found" });
        }

        if (order.status !== 'Pending' && order.status !== 'Processing') {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Cannot cancel this order" });
        }

        order.status = 'Cancelled';
        
        // Add to history
        order.orderHistory.push({
            status: 'Cancelled',
            date: new Date(),
            comment: 'Cancelled by User'
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

export default {loadOrders, cancelOrder, orderDetailedPage};