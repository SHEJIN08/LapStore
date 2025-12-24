import Cart from "../../model/cartModel.js";
import Address from "../../model/addressModel.js";
import Coupon from "../../model/couponModel.js";
import Order from "../../model/orderModel.js";
import Variant from "../../model/variantModel.js";
import Offer from "../../model/offerModel.js";
import cartService from "./cartService.js";
import {calculateProductDiscount} from "../../services/admin/productService.js"
import mongoose from "mongoose";
import Wallet from "../../model/walletModel.js";
import walletService from "./walletService.js";

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

    if (!cartItems.length) return null;

    // 3. Calculate Totals
    let subtotal = 0;
    cartItems.forEach(item => {
        subtotal += item.variantId.salePrice * item.quantity;
    });
    const tax = subtotal * 0.05;
    const shipping = subtotal > 100000 ? 0 : 100;
    const total = subtotal + tax + shipping;
    // 3. Fetch Coupons
    const currentDate = new Date();
    const coupons = await Coupon.find({
        isActive: true,          // Must be active
        isListed: true,          // Must be listed (if you have this field)
        startDate: { $lte: currentDate }, // Start date is past or today
        endDate: { $gt: currentDate },    // Not expired
        
        // --- THE FIX: Check Eligibility ---
        $or: [
            { userEligibility: 'all' },           // 1. Coupon is for everyone
            { specificUsers: { $in: [userId] } }  // 2. OR User is in the specific list
        ]
    }).sort({ createdAt: -1 });

    return { addresses, cartItems, coupons, subtotal, tax, shipping, total };
};

const applyCouponService = async (userId, couponCode, totalAmount) => {
    try {
        // 1. Validation Logic
        if (!couponCode) return { success: false, message: "No coupon code provided" };

        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

        if(coupon.usageLimitPerUser){
            const userUsageCount = await Order.countDocuments({
                userId: userId,
                couponCode: couponCode,
                status: { $nin: ['Cancelled','Failed']}
            })
            if(userUsageCount >= coupon.usageLimitPerUser){
                return {success: false, message: 'You have reached user usage limit'}
            }
        }

        if (!coupon) {
            return { success: false, message: 'Invalid Coupon code' };
        }
        if (!coupon.isActive) {
            return { success: false, message: 'This coupon is inactive' };
        }
        if (new Date(coupon.endDate) < new Date()) {
            return { success: false, message: 'This coupon has expired' };
        }

        

        if (coupon.userEligibility === 'specific' && !coupon.specificUsers.includes(userId)) {
            return { success: false, message: 'You are not eligible for this coupon' };
        }

        // Parse totalAmount to ensure it's a number
        const total = parseFloat(totalAmount); 

        if (total < coupon.minPurchaseAmount) {
            return { success: false, message: `Minimum purchase of ₹${coupon.minPurchaseAmount} required` };
        }

        // 2. Calculate Discount
        let discountAmount = 0;

        if (coupon.type === 'percentage') {
            discountAmount = (total * coupon.discountValue) / 100;
        } else if (coupon.type === 'fixed') {
            discountAmount = coupon.discountValue;
        }

        // Ensure discount doesn't exceed total
        if (discountAmount > total) {
            discountAmount = total;
        }

        const newTotal = total - discountAmount;

        // 3. RETURN SUCCESS (This was missing for the normal case!)
        return {
            success: true,
            discountAmount: Math.round(discountAmount),
            newTotal: Math.round(newTotal),
            couponId: coupon._id
        };

    } catch (error) {
        console.error("Service Error:", error);
        return {
            success: false,
            message: error.message || "Error processing coupon"
        };
    }
}

// --- PLACE ORDER ---
const placeOrderService = async (userId, addressId, paymentMethod, paymentDetails = {}, couponCode = null) => {
    
    

    const cartItems = await Cart.find({ userId }).populate('productId').populate('variantId');
    if (!cartItems.length) throw new Error("Cart is empty");

    // 2. Fetch Address
    const addressDoc = await Address.findById(addressId);
    if (!addressDoc) throw new Error("Address not found");

    

    // 3. Check Stock & Calculate Subtotal
    let subtotal = 0;
    const orderedItems = [];

    for (const item of cartItems) {
       if (!item.variantId) {
            continue;
        }
        if (item.variantId.stock < item.quantity) {
             throw new Error(`Out of stock: ${item.productId.name}`);
        }

        const productForOffer = item.productId;
        productForOffer.regularPrice = item.variantId.salePrice;

        const { finalPrice, offerId } = await calculateProductDiscount(productForOffer);

        subtotal += finalPrice * item.quantity;

        orderedItems.push({
            productId: item.productId._id,
            variantId: item.variantId._id,
            productName: item.productId.name,
            image: Array.isArray(item.variantId.image) ? item.variantId.image[0] : item.variantId.image,
            productStatus: 'Placed',
            quantity: item.quantity,
            price: finalPrice,
            offerId: offerId
        });
    }

    let discount = 0;
    let appliedCouponCode = null; // Will be null if invalid

    if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
        
        // Check if coupon is valid (Active, Date, Min Amount, Eligibility)
        if (coupon && 
            coupon.isActive && 
            new Date(coupon.endDate) > new Date() &&
            subtotal >= coupon.minPurchaseAmount
        ) {

            if (coupon.usageLimitPerUser) {
                const userUsageCount = await Order.countDocuments({
                    userId: userId,
                    couponCode: coupon.code,
                    status: { $nin: ['Cancelled', 'Failed'] }
                });

                if (userUsageCount >= coupon.usageLimitPerUser) {
                    throw new Error('You have already used this coupon the maximum number of times.');
                }
            }
            // Recalculate discount securely
            if (coupon.type === 'percentage') {
                discount = (subtotal * coupon.discountValue) / 100;
            } else {
                discount = coupon.discountValue;
            }
            
            // Cap discount if needed
            if (discount > subtotal) discount = subtotal;

            appliedCouponCode = couponCode.toUpperCase();

            if(coupon.totalUsageLimit && coupon.currentUsageCount >= coupon.totalUsageLimit){
                throw new Error('Coupon is no longer available (Usage limit reached)')
            }

            // Optional: Increment usage count
            await Coupon.updateOne({ _id: coupon._id }, { $inc: { currentUsageCount: 1 } });
        }
    }

    // 4. Calculate Final Amount
    const tax = subtotal * 0.05;
    const shipping = subtotal > 100000 ? 0 : 100;
    const finalAmount = Math.round(subtotal + tax + shipping - discount);

    // 5. Create Order Document
    const newOrder = new Order({
        userId,
        orderedItems,
        totalPrice: subtotal,
        discount,
        couponCode,
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

    if(paymentMethod === 'Wallet'){

        const walletResult = await walletService.processWalletPayment(
            userId,
            newOrder.finalAmount,
            newOrder._id
        )

        if (!walletResult.success) {
              throw new Error(walletResult.message);
            }

            newOrder.paymentStatus = 'Paid';
          
    }

    await newOrder.save();

    for(let item of newOrder.orderedItems){
        if(item.offerId){
            await Offer.findByIdAndUpdate(item.offerId, {
                $inc: { usageCount: 1 }
            });
        }
    }

    // 6. Reduce Stock
    for (const item of cartItems) {
        await Variant.findByIdAndUpdate(item.variantId._id, {
            $inc: { stock: -item.quantity } 
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

const getOrderDetails = async (id) => {
    try {
        // 1. Try finding by Custom Order ID (e.g., "770741" or "ORD-123456")
        // We use findOne because 'id' is a custom field, not the primary key _id
        let order = await Order.findOne({ orderId: id }).populate('orderedItems.productId');
       

        // 2. If not found, check if it's a valid MongoDB _id and search that way
        // This acts as a fallback if you mix ID types
        if (!order && mongoose.Types.ObjectId.isValid(id)) {
            order = await Order.findById(id).populate('orderedItems.productId');
        }

        return order;

    } catch (error) {
        console.error("Get Order Details Error:", error);
        return null;
    }
};

export default {
    getCheckoutData,
    placeOrderService,
    getOrderDetails,
    saveFailedOrderService,
    applyCouponService
};