import Cart from "../../model/cartModel.js";
import Address from "../../model/addressModel.js";
import Coupon from "../../model/couponModel.js";
import Order from "../../model/orderModel.js";
import Variant from "../../model/variantModel.js";

// --- GET CHECKOUT DATA ---
const getCheckoutData = async (userId) => {
    // 1. Fetch Addresses
    const addresses = await Address.find({ userId }).sort({ createdAt: -1 });

    // 2. Fetch Cart Items
    let cartItems = await Cart.find({ userId })
        .populate({
            path: 'productId',
            match: { isPublished: true },
            populate: { path: 'brand' }
        })
        .populate('variantId');

    // Filter valid items
    cartItems = cartItems.filter(item => item.productId !== null);

    if (!cartItems.length) return null; // Cart is empty

    // 3. Fetch Coupons
    const coupons = await Coupon.find({
        isListed: true,
        expireOn: { $gt: new Date() }
    });

    // 4. Calculate Totals
    let subtotal = 0;
    cartItems.forEach(item => {
        if (item.variantId) {
            subtotal += item.variantId.salePrice * item.quantity;
        }
    });

    const tax = subtotal * 0.05;
    const shipping = subtotal > 100000 ? 0 : 100;
    const total = subtotal + tax + shipping;

    return { addresses, cartItems, coupons, subtotal, tax, shipping, total };
};

// --- PLACE ORDER ---
const placeOrderService = async (userId, addressId, paymentMethod, paymentDetails = {}) => {
    

    const cartItems = await Cart.find({ userId }).populate('productId').populate('variantId');
    if (!cartItems.length) throw new Error("Cart is empty");

    // 2. Fetch Address
    const addressDoc = await Address.findById(addressId);
    if (!addressDoc) throw new Error("Address not found");

    // 3. Check Stock & Calculate Subtotal
    let subtotal = 0;
    const orderedItems = [];

    for (const item of cartItems) {
        // Stock Check (Ensure variant exists and has stock)
       if (!item.variantId) {
            continue; // Skip invalid items
        }
        if (item.variantId.stock < item.quantity) {
             throw new Error(`Out of stock: ${item.productId.name}`);
        }

        const price = item.variantId.salePrice;
        subtotal += price * item.quantity;

        orderedItems.push({
            productId: item.productId._id,
            variantId: item.variantId._id,
            productName: item.productId.name,
            image: item.variantId.image[0],
            productStatus: 'Placed',
            quantity: item.quantity,
            price: price
        });
    }

    // 4. Calculate Final Amount
    const tax = subtotal * 0.05;
    const shipping = subtotal > 100000 ? 0 : 100;
    const discount = 0; // Future coupon logic
    const finalAmount = subtotal + tax + shipping - discount;

    // 5. Create Order Document
    const newOrder = new Order({
        userId,
        orderedItems,
        totalPrice: subtotal,
        discount,
        finalAmount,
        address: {
            fullName: addressDoc.fullName,
            phone: addressDoc.phone,
            addressType: addressDoc.addressType,
            address1: addressDoc.address1,
            address2: addressDoc.address2,
            city: addressDoc.city,
            state: addressDoc.state,
            pincode: addressDoc.pincode
        },
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
        razorpayStatus: paymentMethod === 'Razorpay' ? 'Paid' : 'Pending', 
        razorpayOrderId: paymentDetails.razorpayOrderId || null,
        razorpayPaymentId: paymentDetails.razorpayPaymentId || null,
        status: 'Pending',
        orderHistory: [{
            status: 'Pending',
            date: new Date(),
            comment: 'Order Placed'
        }]
    });

    await newOrder.save();

    // 6. Reduce Stock
    for (const item of cartItems) {
        await Variant.findByIdAndUpdate(item.variantId._id, {
            $inc: { stock: -item.quantity } // Use 'stock', your model likely uses 'stock' not 'quantity' for inventory
        });
    }

    // 7. Clear Cart
    await Cart.deleteMany({ userId });

    return newOrder;
};

const saveFailedOrderService = async (userId, addressId, paymentDetails) => {
    
    // 1. Fetch Cart
    const cartItems = await Cart.find({ userId }).populate('productId').populate('variantId');
    if (!cartItems || cartItems.length === 0) return null; // Nothing to save

    // 2. Fetch Address
    const addressDoc = await Address.findOne({ _id: addressId });
    if (!addressDoc) throw new Error("Address not found");

    // 3. Calculate Totals (Same logic as placeOrder)
    let subtotal = 0;
    const orderedItems = [];

    for (const item of cartItems) {
        if (!item.variantId) continue;
        
        const price = item.variantId.salePrice;
        subtotal += price * item.quantity;

        orderedItems.push({
            productId: item.productId._id,
            variantId: item.variantId._id,
            productName: item.productId.name,
            image: item.variantId.image,
            productStatus: 'Failed', // Set individual item status
            quantity: item.quantity,
            price: price
        });
    }

    const tax = subtotal * 0.05;
    const shipping = subtotal > 100000 ? 0 : 100;
    const finalAmount = subtotal + tax + shipping;

    // 4. Create Order Document with 'Failed' Status
    const failedOrder = new Order({
        userId,
        orderedItems,
        totalPrice: subtotal,
        finalAmount,
        address: {
            fullName: addressDoc.fullName,
            phone: addressDoc.phone,
            addressType: addressDoc.addressType,
            address1: addressDoc.address1,
            address2: addressDoc.address2,
            city: addressDoc.city,
            state: addressDoc.state,
            pincode: addressDoc.pincode
        },
        paymentMethod: 'Razorpay',
        paymentStatus: 'Failed', // <--- Key Change
        razorpayStatus: 'Failed', // <--- Key Change
        razorpayOrderId: paymentDetails.razorpayOrderId,
        razorpayPaymentId: paymentDetails.razorpayPaymentId,
        status: 'Failed', // <--- Key Change
        orderId: `ORD-${Date.now()}`,
        orderHistory: [{
            status: 'Failed',
            date: new Date(),
            comment: 'Payment Failed by User or Bank'
        }]
    });

    await failedOrder.save();
    
    
    
    return failedOrder;
};

// --- GET ORDER DETAILS (Success Page) ---
const getOrderDetails = async (orderId) => {
    return await Order.findOne({ orderId });
};

export default {
    getCheckoutData,
    placeOrderService,
    getOrderDetails,
    saveFailedOrderService
};