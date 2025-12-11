import Cart from "../../model/cartModel.js"
import Product from "../../model/productModel.js"
import Variant from "../../model/variantModel.js"
import User from '../../model/userModel.js'
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadCart = async (req,res) => {
 try { 
   const userId = req.session.user;
        const user = await User.findById(userId);

        // --- 1. CONFIGURATION ---
        const page = parseInt(req.query.page) || 1;
        const limit = 3; // Items per page
        const skip = (page - 1) * limit;

        // --- 2. CALCULATE TOTALS (Fetch ALL items) ---
        // We need a separate query to calculate the correct Subtotal for the WHOLE cart
        const allCartItems = await Cart.find({ userId: userId }).populate('variantId');

        let subtotal = 0;
        allCartItems.forEach(item => {
            // Check if variant exists (product wasn't deleted)
            if (item.variantId) {
                subtotal += item.variantId.salePrice * item.quantity;
            }
        });

        const tax = subtotal * 0.05;
        const shipping = subtotal > 100000 ? 0 : 100;
        const total = subtotal + tax + shipping;

        // --- 3. FETCH DISPLAY ITEMS (Paginated) ---
        // This query fetches only the 5 items we need to show right now
        const cartItems = await Cart.find({ userId: userId })
            .populate({
                path: 'productId',
                populate: { path: 'brand' } 
            })
            .populate('variantId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalItems = allCartItems.length; // Count from the first query
        const totalPages = Math.ceil(totalItems / limit);

        // --- 4. THE SWITCH (Crucial Step) ---
        
        // CASE A: AJAX Request (From your "Next" button)
        if (req.query.ajax) {
            
            // We render ONLY the partial (the loop), not the whole page
            return res.render("user/partials/cart-items-list", { 
                cartItems: cartItems, 
                layout: false // Do not include header/footer
            }, (err, html) => {
                if (err) throw err;
                
                // Send JSON back to Axios
                return res.json({
                    success: true,
                    html: html,
                    summary: { subtotal, tax, shipping, total },
                    totalPages: totalPages,
                    currentPage: page
                });
            });
        }

        // CASE B: Standard Page Load (Browser refresh)
        res.render("user/cart", {
            user: user,
            cartItems: cartItems,
            subtotal,
            tax,
            shipping,
            total,
            totalPages,     // Pass these to view for initial render
            currentPage: page
        });

 } catch (error) {
    console.error(error)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({sucess:false, message: ResponseMessage.SERVER_ERROR})
 }
}

// --- 2. ADD TO CART (API) ---
  const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;

    if(!userId){
        return res.status(StatusCode.UNAUTHORIZED).json({sucess: false, message: ResponseMessage.UNAUTHORIZED})
    }
    const { productId, variantId, quantity } = req.body;
    const qtyToAdd = parseInt(quantity) || 1;

    // --- STEP 1: FETCH STOCK ---
    const variant = await Variant.findById(variantId);
    
    if (!variant) {
        return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Product variant not found" });
    }

    // Basic check: Is the requested amount more than we have *total*?
    if (qtyToAdd > variant.stock) {
        return res.json({ success: false, message: `Only ${variant.stock} items left in stock` });
    }

    // --- STEP 2: CHECK CART STATUS ---
    const existingItem = await Cart.findOne({ userId, productId, variantId });

    if (existingItem) {
      // --- STEP 3: LOGIC FOR EXISTING ITEM ---
      const totalFutureQuantity = existingItem.quantity + qtyToAdd;

      // Validation: Does this exceed stock?
      if (totalFutureQuantity > variant.stock) {
         return res.json({ 
             success: false, 
             message: `Cannot add ${qtyToAdd} more. You already have ${existingItem.quantity} in cart and we only have ${variant.stock} left.` 
         });
      }

      // If safe, update
      existingItem.quantity += qtyToAdd;
      await existingItem.save();
      return res.json({ success: true, message: "Cart updated" });

    } else {
      // --- STEP 4: LOGIC FOR NEW ITEM ---
      
      const newCartItem = new Cart({
        userId,
        productId,
        variantId,
        quantity: qtyToAdd
      });

      await newCartItem.save();
      return res.json({ success: true, message: "Added to cart" });
    }

  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// --- 3. UPDATE QUANTITY (API) ---
 const updateCartQuantity = async (req, res) => {
  try {
    const { cartId, action } = req.body; // action can be "increment" or "decrement"
    
    const cartItem = await Cart.findById(cartId).populate('variantId');
    
    if (!cartItem) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Item not found" });
    }

    const currentStock = cartItem.variantId.stock; // Assuming variant has 'quantity' field

    // Logic
    if (action === "increment") {
      if (cartItem.quantity < currentStock && cartItem.quantity < 6) { // Max 5 per user limit
        cartItem.quantity += 1;
      } else {
        return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Max stock reached" });
      }
    } else if (action === "decrement") {
      if (cartItem.quantity > 1) {
        cartItem.quantity -= 1;
      }
    }
    if (cartItem.quantity >= currentStock) {
        return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Out of stock" });
      }
      
      if (cartItem.quantity > 5) {
        return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Max 5 items allowed per user" });
      }
    

    await cartItem.save();


    res.json({ success: true, message: "Quantity updated" });

  } catch (error) {
    console.error("Update qty error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR});
  }
};

// --- 4. REMOVE ITEM (API) ---
const removeFromCart = async (req, res) => {
  try {
    const { cartId } = req.body; // or req.params depending on route style

    await Cart.findByIdAndDelete(cartId);

    res.json({ success: true, message: "Item removed" });

  } catch (error) {
    console.error("Remove item error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR});
  }
};



export default {loadCart, addToCart, updateCartQuantity, removeFromCart}