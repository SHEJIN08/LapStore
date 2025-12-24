import checkoutService from "../../services/user/checkoutService.js";
import paymentService from "../../services/paymentService.js";
import User from "../../model/userModel.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";
import walletService from "../../services/user/walletService.js";

// --- LOAD CHECKOUT PAGE ---
const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId); 
        
        const { wallet } = await walletService.getWalletData(userId)

        const data = await checkoutService.getCheckoutData(userId);

        if (!data) {
            return res.redirect('/user/home/shop');
        }

        res.render("user/checkout", {
            user: userId,
            addresses: data.addresses,
            cartItems: data.cartItems,
            coupons: data.coupons,
            subtotal: data.subtotal,
            tax: data.tax,
            shipping: data.shipping,
            total: data.total,
            wallet: wallet,
            total: data.total
        });

    } catch (error) {
        console.error("Load Checkout Error:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- 1. CREATE PAYMENT ORDER (API) ---
const createPaymentOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        
        // Call Payment Service
        const order = await paymentService.createRazorpayOrderService(amount);

        res.status(StatusCode.OK).json({
            success: true,
            id: order.id,         // Send Razorpay Order ID to frontend
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Payment Init Error:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to initiate payment" });
    }
};

// --- 2. VERIFY PAYMENT & PLACE ORDER (API) ---
const verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature, 
            addressId, // We need this to create the actual order
            couponCode
        } = req.body;
        
        const userId = req.session.user;


        if (!addressId) {
            return res.status(StatusCode.BAD_REQUEST).json({ 
                success: false, 
                message: "Address ID is missing. Please select an address." 
            });
        }

        // A. Verify Signature
        const isValid = paymentService.verifySignatureService(
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature
        );

        if (!isValid) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Payment Verification Failed" });
        }

        // B. Signature is Valid -> Place the Order in DB
        const newOrder = await checkoutService.placeOrderService(
            userId, 
            addressId, 
            "Razorpay", // Payment Method
            { 
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
            },
            couponCode
        );

        res.status(StatusCode.OK).json({ 
            success: true, 
            orderId: newOrder.orderId,
            message: "Order placed successfully" 
        });

    } catch (error) {
        console.error("Payment Verify Error:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
};

// --- PLACE ORDER API ---
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod, paymentDetails, couponCode } = req.body;

        const newOrder = await checkoutService.placeOrderService(userId, addressId, paymentMethod, paymentDetails, couponCode);

        return res.json({   
            success: true,
            message: "Order placed successfully",
            orderId: newOrder.orderId
        });

    } catch (error) {
        // Handle Known Logic Errors (Stock, Address, Empty Cart)
        if (error.message.includes("stock") || error.message === "Cart is empty" || error.message === "Address not found") {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
        }
        
        console.error("Place Order Error:", error);
         res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message:error.message });
    }
};

// --- ORDER SUCCESS PAGE ---
const orderSuccess = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user;
        const user = await User.findById(userId);
        
        const order = await checkoutService.getOrderDetails(orderId);
    

        if (!order) {
             return res.render("user/404");
        }

     res.render("user/orderSuccess", {
            user,
            orderId: orderId,
            order: order, 
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: order.razorpayPaymentId
        });
    } catch (error) {
        console.error(error);
        res.render("user/404");
    }
};

const orderFailed = async (req, res) => {
    try {
        const { error, orderId, razorpayOrderId, razorpayPaymentId } = req.query;
        res.render('user/orderFailure', {
            error: error,
            orderId: orderId, // Pass this if you have a Pending order ID
            razorpayOrderId: razorpayOrderId,     // Razorpay Order ID
            razorpayPaymentId: razorpayPaymentId, // Razorpay Payment ID
            user: req.session.user // Ensure navbar works
        });
    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
};

const handleFailedPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_error,
            addressId 
        } = req.body;
        
        const userId = req.session.user;

        const failedOrder = await checkoutService.saveFailedOrderService(
            userId, 
            addressId, 
            { 
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id
            }
        );

        res.status(StatusCode.OK).json({ 
            success: true, 
            orderId: failedOrder ? failedOrder.orderId : null,
            message: "Failed order saved" 
        });

    } catch (error) {
        console.error("Failed Order Save Error:", error);
        res.status(StatusCode.OK).json({ success: false }); 
    }
};
const applyCoupon = async (req, res) => {
    try {
        const { couponCode, subtotal } = req.body;
        const userId = req.session.user;

        const result = await checkoutService.applyCouponService(userId, couponCode, subtotal);

        if (!result) {
            return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: "Something went wrong while applying the coupon." 
            });
        }

        if (!result.success) {
            return res.status(StatusCode.OK).json({ 
                success: false, 
                message: result.message 
            });
        }

     
        req.session.appliedCoupon = {
            code: couponCode,
            discount: result.discountAmount
        };

        return res.status(StatusCode.OK).json({ 
            success: true, 
            discount: result.discountAmount,
            newTotal: result.newTotal,
            message: "Coupon Applied Successfully!"
        });

    } catch (error) {
        console.error("Apply Coupon Error:", error);
         res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message:  ResponseMessage.SERVER_ERROR });
    }
};

const removeCoupon = async (req, res) => {
    try {
        // Clear from session
        req.session.appliedCoupon = null;
        res.json({ success: true, message: "Coupon removed" });
    } catch (error) {
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
}



export default { loadCheckout, createPaymentOrder, verifyPayment, placeOrder, orderSuccess, orderFailed, handleFailedPayment, applyCoupon, removeCoupon };