import cartService from "../../services/user/cartService.js";
import User from '../../model/userModel.js';
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

// --- LOAD CART PAGE ---
const loadCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    // 1. Configuration
    const page = parseInt(req.query.page) || 1;
    const limit = 3;

    // 2. Get Data via Service
    const allCartItems = await cartService.getAllCartItems(userId);
    const { subtotal, tax, shipping, total } = cartService.calculateTotals(allCartItems);
    
    // 3. Get Display Items
    const cartItems = await cartService.getPaginatedCartItems(userId, page, limit);

    const totalItems = allCartItems.length;
    const totalPages = Math.ceil(totalItems / limit);

    // 4. Handle AJAX vs Standard Request
    if (req.query.ajax) {
        return res.render("user/partials/cart-items-list", { 
            cartItems: cartItems, 
            layout: false 
        }, (err, html) => {
            if (err) throw err;
            return res.json({
                success: true,
                html: html,
                summary: { subtotal, tax, shipping, total },
                totalPages: totalPages,
                currentPage: page
            });
        });
    }

    // Standard Render
    res.render("user/cart", {
        user,
        cartItems,
        subtotal, tax, shipping, total,
        totalPages,
        currentPage: page
    });

  } catch (error) {
    console.error("Load Cart Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success:false, message: ResponseMessage.SERVER_ERROR});
  }
};

// --- ADD TO CART ---
const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    if(!userId) return res.status(StatusCode.UNAUTHORIZED).json({success: false, message: ResponseMessage.UNAUTHORIZED});

    const { productId, variantId, quantity } = req.body;

    const message = await cartService.addToCartService(userId, productId, variantId, quantity);

    res.json({ success: true, message });

  } catch (error) {
    const logicErrors = ["Product variant not found", "Out of stock"];
    if (error.message.includes("stock") || error.message.includes("left") || error.message.includes("found")) {
         return res.json({ success: false, message: error.message });
    }

    console.error("Add Cart Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

// --- UPDATE QUANTITY ---
const updateCartQuantity = async (req, res) => {
  try {
    const { cartId, action } = req.body;
    
    await cartService.updateQuantityService(cartId, action);
    
    res.json({ success: true, message: "Quantity updated" });

  } catch (error) {
    // Handle logic errors gracefully
    if (error.message === "Out of stock" || error.message.includes("Max")) {
        return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
    if (error.message === "Item not found") {
        return res.status(StatusCode.NOT_FOUND).json({ success: false, message: error.message });
    }

    console.error("Update Qty Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR});
  }
};

// --- REMOVE ITEM ---
const removeFromCart = async (req, res) => {
  try {
    const { cartId } = req.body;
    
    await cartService.removeFromCartService(cartId);

    res.json({ success: true, message: "Item removed" });

  } catch (error) {
    console.error("Remove Item Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR});
  }
};

export default { loadCart, addToCart, updateCartQuantity, removeFromCart };