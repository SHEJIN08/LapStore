import checkoutService from "../../services/user/checkoutService.js";
import User from "../../model/userModel.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

// --- LOAD CHECKOUT PAGE ---
const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);

        const data = await checkoutService.getCheckoutData(userId);

        if (!data) {
            return res.redirect('/user/home/shop');
        }

        res.render("user/checkout", {
            user,
            addresses: data.addresses,
            cartItems: data.cartItems,
            coupons: data.coupons,
            subtotal: data.subtotal,
            tax: data.tax,
            shipping: data.shipping,
            total: data.total
        });

    } catch (error) {
        console.error("Load Checkout Error:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- PLACE ORDER API ---
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod } = req.body;

        const newOrder = await checkoutService.placeOrderService(userId, addressId, paymentMethod);

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
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
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

        res.render("user/orderSuccess", { orderId, order, user });
    } catch (error) {
        console.error(error);
        res.render("user/404");
    }
};

export default { loadCheckout, placeOrder, orderSuccess };