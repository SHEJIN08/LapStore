import Cart from "../../model/cartModel.js";
import Variant from "../../model/variantModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET ALL ITEMS (For Totals) ---
const getAllCartItems = async (userId) => {
    return await Cart.find({ userId }).populate('variantId');
};

// --- GET PAGINATED ITEMS (For Display) ---
const getPaginatedCartItems = async (userId, page = 1, limit = 3) => {
    const skip = (page - 1) * limit;
    
    let cartItems = await Cart.find({ userId })
        .populate({
            path: 'productId',
            match: { isPublished: true },
            populate: { path: 'brand' }
        })
        .populate('variantId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    // Filter out null products (deleted/unpublished)
    return cartItems.filter(item => item.productId !== null);
};

// --- CALCULATE FINANCIALS ---
const calculateTotals = (cartItems) => {
    let subtotal = 0;
    
    cartItems.forEach(item => {
        if (item.variantId) {
            subtotal += item.variantId.salePrice * item.quantity;
        }
    });

    const tax = subtotal * 0.05;
    const shipping = subtotal > 100000 ? 0 : 100;
    const total = subtotal + tax + shipping;

    return { subtotal, tax, shipping, total };
};

// --- ADD TO CART ---
const addToCartService = async (userId, productId, variantId, quantity) => {
    const qtyToAdd = parseInt(quantity) || 1;

    // 1. Fetch Variant & Check Stock
    const variant = await Variant.findById(variantId);
    if (!variant) throw new Error("Product variant not found");

    if (qtyToAdd > variant.stock) {
        throw new Error(`Only ${variant.stock} items left in stock`);
    }

    // 2. Check Existing Cart Item
    const existingItem = await Cart.findOne({ userId, productId, variantId });

    if (existingItem) {
        const totalFutureQuantity = existingItem.quantity + qtyToAdd;

        if (totalFutureQuantity > variant.stock) {
            throw new Error(`Cannot add ${qtyToAdd} more. You have ${existingItem.quantity} in cart, only ${variant.stock} left.`);
        }

        existingItem.quantity += qtyToAdd;
        await existingItem.save();
        return "Cart updated";
    } else {
        const newCartItem = new Cart({
            userId,
            productId,
            variantId,
            quantity: qtyToAdd
        });
        await newCartItem.save();
        return "Added to cart";
    }
};

// --- UPDATE QUANTITY ---
const updateQuantityService = async (cartId, action) => {
    const cartItem = await Cart.findById(cartId).populate('variantId');
    if (!cartItem) throw new Error("Item not found");

    const currentStock = cartItem.variantId.stock;

    if (action === "increment") {
        // Validation 1: Stock Limit
        if (cartItem.quantity >= currentStock) {
             throw new Error("Out of stock");
        }
        // Validation 2: Max per User Limit
        if (cartItem.quantity >= 5) { // Check if currently 5 or more (logic adjustment)
             throw new Error("Max 5 items allowed per user");
        }
        cartItem.quantity += 1;
    } 
    else if (action === "decrement") {
        if (cartItem.quantity > 1) {
            cartItem.quantity -= 1;
        }
    }

    await cartItem.save();
    return "Quantity updated";
};

// --- REMOVE ITEM ---
const removeFromCartService = async (cartId) => {
    await Cart.findByIdAndDelete(cartId);
    return true;
};

export default {
    getAllCartItems,
    getPaginatedCartItems,
    calculateTotals,
    addToCartService,
    updateQuantityService,
    removeFromCartService
};