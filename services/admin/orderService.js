import Order from "../../model/orderModel.js";
import Wallet from "../../model/walletModel.js";
import walletTransactions from "../../model/walletTransactionsModel.js";
import Variant from "../../model/variantModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET ALL ORDERS (Filter, Search, Pagination) ---
const getAllOrdersService = async ({ startDate, endDate, search, status, page = 1, limit = 4 }) => {
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
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    if (validStatuses.includes(status)) {
        query.status = status;
    }

    // 3. Search Filter
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { orderId: searchRegex },
            { 'address.fullName': searchRegex }
        ];
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
    const order = await Order.findById(orderId).populate('userId');
    if (!order) throw new Error("Order not found");
    return order;
};

// --- UPDATE ORDER STATUS ---
const updateOrderStatusService = async (orderId, status) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    order.status = status;

   if (status === 'Delivered') {
        order.orderedItems.forEach(item => {
            if (item.productStatus !== 'Cancelled' && item.productStatus !== 'Returned') {
                item.productStatus = 'Delivered';
            }
        });
        
        if (order.paymentMethod === 'COD') {
            order.paymentStatus = 'Paid';
        }
    } 
    // Optional: If Order is Cancelled, mark items Cancelled
    else if (status === 'Cancelled') {
         order.orderedItems.forEach(item => {
             item.productStatus = 'Cancelled';
         });
    }

    order.orderHistory.push({
        status: status,
        date: new Date(),
        comment: `Status updated to ${status} by Admin`
    });

    await order.save();
    return order;
};

// --- HANDLE RETURN REQUEST ---
const processReturnRequestService = async ({ orderId, itemId, action }) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    let wallet = await Wallet.findOne({userId: order.userId})

    if(!wallet){
        wallet = new Wallet({userId: order.userId, balance: 0})

        await wallet.save()
    }

    const TAX_RATE = 0.05;
    const CONVENIENCE_FEE = 30;

    // --- OPTION 1: Handle Specific Item Return ---
    if (itemId) {
        const item = order.orderedItems.id(itemId);
        if (!item) throw new Error("Item not found");   

        if (action === 'approve') {
            // Calculate Refund
            const itemBasePrice = item.price * item.quantity;
            const priceAfterTax = itemBasePrice + (itemBasePrice * TAX_RATE);
            const shippingRefund = (priceAfterTax > 100000) ? 0 : 1000;
            const refundAmount = Math.max(0, (priceAfterTax + shippingRefund) - CONVENIENCE_FEE);

            item.productStatus = 'Returned';

           
            
            // TODO: Wallet Logic
            wallet.balance += refundAmount
            await wallet.save();

            await Variant.findByIdAndUpdate(item.variantId, {
                $inc: {stock: item.quantity}
            })

            await walletTransactions.create({
                userId: wallet.userId,
                walletId: wallet._id,
                amount: refundAmount,
                type: 'credit',
                reason: 'refund',
                description: 'Your products money have refunded'
            })

        } else if (action === 'reject') {
            item.productStatus = 'Return Rejected';
        }
    } 
    
    // --- OPTION 2: Handle Whole Order Return ---
    else {
        if (action === 'approve') {
            order.status = 'Returned';
            order.returnRequest.status = 'Approved';

          for(const item of order.orderedItems){
              item.productStatus = 'Returned'

            await Variant.findByIdAndUpdate(item.variantId, {
                $inc: {stock: item.quantity}
            })
          }

            const totalPaid = order.finalAmount;
            const refundAmount = totalPaid - CONVENIENCE_FEE;

            // TODO: Wallet Logic
              wallet.balance += refundAmount
            await wallet.save();

            await walletTransactions.create({
                userId: wallet.userId,
                walletId: wallet._id,
                amount: refundAmount,
                type: 'credit',
                reason: 'refund',
                description: 'Your products money has refunded'
            })

        } else if (action === 'reject') {
            order.returnRequest.status = 'Rejected';
            order.status = 'Return Rejected'; // Ensure main status updates so UI clears
            
            // Reset pending items to Delivered/Rejected as needed
            order.orderedItems.forEach(p => {
                if(p.productStatus === 'Return Request') p.productStatus = 'Return Rejected';
            });
        }
    }

    // --- SYNC MAIN ORDER STATUS ---
    // (This logic ensures that if all items are returned/rejected, the main order status updates)
    order.markModified('orderedItems');
    
    const itemStatuses = order.orderedItems.map(item => item.productStatus);

    // Check conditions
    const hasPendingRequests = itemStatuses.includes('Return Request');
    const allReturned = itemStatuses.every(status => status === 'Returned');
    const allCancelledOrReturned = itemStatuses.every(status => ['Returned', 'Cancelled', 'Return Rejected'].includes(status));
    
    const hasActiveItems = order.orderedItems.some(item => 
        ['Placed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(item.productStatus)
    );

    if (!hasPendingRequests) {
        if (allReturned) {
            order.status = 'Returned';
            if (order.returnRequest) order.returnRequest.status = 'Approved';
        } 
        else if (hasActiveItems) {
            // If any item is Delivered, Order is Delivered. Otherwise check Shipped, etc.
            if (itemStatuses.includes('Delivered')) {
                order.status = 'Delivered';
            } else if (itemStatuses.includes('Shipped')) {
                order.status = 'Shipped';
            } else if (itemStatuses.includes('Processing')) {
                order.status = 'Processing';
            } else {
                order.status = 'Processing'; 
            }
        } 
        else if (allCancelledOrReturned) {
            // If everything is either Returned, Cancelled or Rejected, and nothing is active
            // We can set it to 'Returned' if there is at least one return, otherwise 'Cancelled'
             if (itemStatuses.includes('Returned')) {
                 order.status = 'Returned';
             } else {
                 order.status = 'Return Rejected'; 
             }
        }
    }

    await order.save();
    return true;
};

export default {
    getAllOrdersService,
    getOrderByIdService,
    updateOrderStatusService,
    processReturnRequestService
};