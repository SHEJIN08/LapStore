import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js"
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const getOrder = async (req,res) => {
    try {
      const {startDate,endDate} = req.query;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        let query = {};


        // --- DATE FILTER LOGIC ---
        if (startDate || endDate) {
            query.createdAt = {};

            if (startDate) {
                // $gte = Greater Than or Equal to (Start of the day 00:00:00)
                query.createdAt.$gte = new Date(startDate);
            }

            if (endDate) {
                // $lte = Less Than or Equal to
                // PROBLEM: new Date("2025-12-10") gives 00:00:00. 
                // We need to set it to the END of that day (23:59:59) so we include orders from that day.
                
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                
                query.createdAt.$lte = end;
            }
        }

        if(status === 'Pending'){
          query.status = 'Pending';
        }else if (status === 'Processing'){
          query.status = 'Processing';
        }

      if(search) {
        const searchRegex = new RegExp(search, 'i')

        query.$or = [
            {orderId: searchRegex},
            {'address.fullName': searchRegex}
        
        ]
      }
      //orderId,cusotmerName,email

      const orderData = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

      const totalOrders = await Order.countDocuments();
      const totalPages = Math.ceil(totalOrders / limit)

      res.render('admin/orderList', {
        orders: orderData,
        currentSearch: search,
        currentStatus: status,
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders,
      })

    } catch (error) {
        console.error(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
}

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const userId = req.session.user;

        const user = await User.findById(userId)
      
        const order = await Order.findById(orderId);

        if (!order) {
            return res.redirect('/admin/orders');
        }

        res.render('admin/orderDetails', { order, user });
    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        
        const order = await Order.findById(orderId);
        if(!order) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: 'Order not found' });
        }

        // Update status
        order.status = status;
        
        // Update Payment status automatically if Delivered
        if (status === 'Delivered' && order.paymentMethod === 'COD') {
            order.paymentStatus = 'Paid';
        }

        // Add to History
        order.orderHistory.push({
            status: status,
            date: new Date(),
            comment: `Status updated to ${status} by Admin`
        });

        await order.save();

        res.status(StatusCode.OK).json({ success: true, message: 'Order status updated' });

    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

export default {getOrder, getOrderDetails, updateOrderStatus}