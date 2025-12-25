import orderService from "../../services/admin/orderService.js";
import referralService from "../../services/user/referralService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

// --- GET ORDERS LIST ---
const getOrder = async (req, res) => {
    try {
        const { startDate, endDate, search, status } = req.query;
        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;

        // Call Service
        const { orders, totalOrders, totalPages } = await orderService.getAllOrdersService({
            startDate, endDate, search, status, page, limit
        });

        res.render('admin/orderList', {
            orders: orders,
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders,
            currentSearch: search || '',
            currentStatus: status || 'All',
            startDate: startDate || '',
            endDate: endDate || '',
        });

    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- GET ORDER DETAILS ---
const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const order = await orderService.getOrderByIdService(orderId);
        const user = order.userId;

        res.render('admin/orderDetails', { order, user });

    } catch (error) {
        if (error.message === "Order not found") {
             return res.redirect('/admin/orders');
        }
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- UPDATE STATUS ---
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

      const order =  await orderService.updateOrderStatusService(orderId, status);

        if(status === 'Delivered'){
            await referralService.checkAndCreditReferral(order.userId)
        }

        res.status(StatusCode.OK).json({ success: true, message: 'Order status updated' });

    } catch (error) {
        if (error.message === "Order not found") {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Order not found' });
        }
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- HANDLE RETURN REQUEST ---
const handleReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, action } = req.body;

        await orderService.processReturnRequestService({ orderId, itemId, action });

        return res.status(StatusCode.OK).json({ success: true, message: "Return processed successfully" });

    } catch (error) {
        if (error.message === "Order not found" || error.message === "Item not found") {
             return res.status(StatusCode.NOT_FOUND).json({ success: false, message: error.message });
        }
        console.error("Admin Return Error:", error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

export default { 
    getOrder, 
    getOrderDetails, 
    updateOrderStatus, 
    handleReturnRequest 
};