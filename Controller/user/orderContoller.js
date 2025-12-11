import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";
import Address from "../../model/addressModel.js";
import Cart from "../../model/cartModel.js";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadOrders = async (req,res) => {
    try {
        const userId = req.session.user;

        const user = await User.findById(userId)

        res.render('user/ordersPage', {
            user
        })
    } catch (error) {
        console.error(error);
    }
}

export default {loadOrders};