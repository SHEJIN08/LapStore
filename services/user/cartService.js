import Cart from "../../model/cartModel.js";
import Variant from "../../model/variantModel.js";
import { calculateProductDiscount } from "../../services/admin/productService.js";

const processCartWithOffers = async (cartItems) => {
  const validItems = cartItems.filter(
    (item) => item.productId && item.variantId
  );

  return await Promise.all(
    validItems.map(async (item) => {
      const product = item.productId;

      product.regularPrice = item.variantId.salePrice;

      const { finalPrice, discountAmount, offerId } =
        await calculateProductDiscount(product);

      return {
        ...item.toObject(),
        finalPrice: finalPrice,
        regularPrice: item.variantId.salePrice,
        discountAmount: discountAmount,
        appliedOfferId: offerId,
      };
    })
  );
};

const getAllCartItems = async (userId) => {
  const cartItems = await Cart.find({ userId })
    .populate({
      path: "productId",
      populate: { path: "category" },
    })
    .populate("variantId");

  return await processCartWithOffers(cartItems);
};

// --- GET PAGINATED ITEMS (For Display) ---
const getPaginatedCartItems = async (userId, page = 1, limit = 3) => {
  const skip = (page - 1) * limit;

  let cartItems = await Cart.find({ userId })
    .populate({
      path: "productId",
      match: { isPublished: true },
      populate: [{ path: "brand" }, { path: "category" }],
    })
    .populate("variantId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return await processCartWithOffers(cartItems);
};

// --- CALCULATE FINANCIALS ---
const calculateTotals = (cartItems) => {
  let subtotal = 0;

  cartItems.forEach((item) => {
    if (item.variantId) {
      const price =
        item.finalPrice !== undefined
          ? item.finalPrice
          : item.variantId.salePrice;
      subtotal += price * item.quantity;
    }
  });

  const tax = subtotal * 0.05;
  const shipping = subtotal > 100000 ? 0 : 100;
  const total = Math.round(subtotal + tax + shipping);

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
      throw new Error(
        `Cannot add ${qtyToAdd} more. You have ${existingItem.quantity} in cart, only ${variant.stock} left.`
      );
    }

    existingItem.quantity += qtyToAdd;
    await existingItem.save();
    return "Cart updated";
  } else {
    const newCartItem = new Cart({
      userId,
      productId,
      variantId,
      quantity: qtyToAdd,
    });
    await newCartItem.save();
    return "Added to cart";
  }
};

// --- UPDATE QUANTITY ---
const updateQuantityService = async (cartId, action) => {
  const cartItem = await Cart.findById(cartId).populate("variantId");
  if (!cartItem) throw new Error("Item not found");

  const currentStock = cartItem.variantId.stock;

  if (action === "increment") {
    // Validation 1: Stock Limit
    if (cartItem.quantity >= currentStock) {
      throw new Error("Out of stock");
    }

    if (cartItem.quantity >= 5) {
      throw new Error("Max 5 items allowed per user");
    }
    cartItem.quantity += 1;
  } else if (action === "decrement") {
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
  removeFromCartService,
};
