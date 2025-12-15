import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";
import Variant from "../../model/variantModel.js";
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
                query.createdAt.$gte = new Date(startDate);
            }
            

            if (endDate) {
                
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                
                query.createdAt.$lte = end;
            }
        }

        if(status === 'Pending'){
          query.status = 'Pending';
        }else if (status === 'Processing'){
          query.status = 'Processing';
        }else if (status === 'Shipped'){
          query.status = 'Shipped';
        }else if (status === 'Delivered'){
          query.status = 'Delivered';
        }else if (status === 'Cancelled'){
          query.status = 'Cancelled';
        }else if (status === 'Returned'){
          query.status = 'Returned';
        }
      if(search) {
        const searchRegex = new RegExp(search, 'i')

        query.$or = [
            {orderId: searchRegex},
            {'address.fullName': searchRegex}
        
        ]
      }
      

      const orderData = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

      const totalOrders = await Order.countDocuments();
      const totalPages = Math.ceil(totalOrders / limit)

      res.render('admin/orderList', {
        orders: orderData,
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders,
       currentSearch: search || '', 
        currentStatus: status || 'All',
        startDate: startDate || '', 
        endDate: endDate || '',
      })

    } catch (error) {
        console.error(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
}

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
  
        const order = await Order.findById(orderId).populate('userId');

        if (!order) {
            return res.redirect('/admin/orders');
        }

        const user = order.userId;

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

   
        order.status = status;

        if (status === 'Delivered' && order.paymentMethod === 'COD') {
            order.paymentStatus = 'Paid';
        }

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

const handleReturnRequest = async (req, res) => {
    try {
       const { orderId, itemId, action } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // --- OPTION 1: Handle Specific Item Return ---
        if (itemId) {
            const item = order.orderedItems.id(itemId);
            if (!item) return res.status(404).json({ success: false, message: "Item not found" });

            if (action === 'approve') {
                item.productStatus = 'Returned';
                
                // Refund Logic Calculation (Refund ONLY this item's price)
                const refundAmount = item.price * item.quantity;
                
                // TODO: Add your Wallet/Refund logic here:
                // await Wallet.addMoney(order.userId, refundAmount);
                // await Product.incrementStock(item.productId, item.quantity);

            } else if (action === 'reject') {
                item.productStatus = 'Return Rejected';
            }
        } 
        
        // --- OPTION 2: Handle Whole Order Return (Legacy support) ---
        else {
            if (action === 'approve') {
                order.status = 'Returned';
                order.returnRequest.status = 'Approved';
                // Loop through all items to mark them returned
                order.orderedItems.forEach(p => p.productStatus = 'Returned');
                
                // TODO: Refund Total Amount
            } else if (action === 'reject') {
                order.returnRequest.status = 'Rejected';
                // Reset items to Delivered if rejected
                order.orderedItems.forEach(p => {
                    if(p.productStatus === 'Return Request') p.productStatus = 'Delivered';
                });
            }
        }

        await order.save();
        return res.json({ success: true, message: "Return processed successfully" });

    } catch (error) {
        console.error("Admin Return Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export default {getOrder, getOrderDetails, updateOrderStatus, handleReturnRequest}