import User from "../../model/userModel.js";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import Order from "../../model/orderModel.js";
import Address from "../../model/addressModel.js";
import Cart from "../../model/cartModel.js";
import Coupon from "../../model/couponModel.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadCheckout = async (req,res) => {
    try{

        const userId = req.session.user;
        const user = await User.findById(userId)

        const addresses = await Address.find({userId: userId}).sort({ createdAt: -1 })

        const cartItems = await Cart.find({userId: userId})
        .populate({
            path: 'productId',
            populate: { path: 'brand'}
        })
        .populate('variantId')

        if(!cartItems || cartItems.length === 0){
            return res.redirect('/user/home/shop')
        }

        const coupons = await Coupon.find({ 
        isListed: true, 
        expireOn: { $gt: new Date() } // Only future dates
        });

        let subtotal = 0;
          cartItems.forEach(item => {
           if (item.variantId) {
             subtotal += item.variantId.salePrice * item.quantity;
           }
      });

      const tax = subtotal * 0.05; // 5% Tax
      const shipping = subtotal > 100000 ? 0 : 100; // Free shipping logic
     const total = subtotal + tax + shipping;


    res.render("user/checkout", {
      user,
      addresses,
      cartItems,
      coupons,
      subtotal,
      tax,
      shipping,
      total
    });
    }catch(error){
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const placeOrder = async (req,res) => {
    try {
        const userId = req.session.user;
        const {addressId, paymentMethod} = req.body;

        const cartItems = await Cart.find({ userId }).populate('productId').populate('variantId')

        if(!cartItems.length){
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Cart is empty'})
        }

        const addressDoc = await Address.findById(addressId)
        if(!addressDoc){
             return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Address not found'})
        }

        for(let item of cartItems){
            await Variant.findByIdAndUpdate(item.variantId, {
                $inc: {stock: -item.quantity}
            })
        }

        let subtotal = 0;
        const orderedItems = [];

        for (const item of cartItems) {
        // Stock Check
        if (item.variantId.quantity < item.quantity) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: `Out of stock: ${item.productId.name}` });
        }

        const price = item.variantId.salePrice;
        subtotal += price * item.quantity;

        orderedItems.push({
            productId: item.productId._id,
            variantId: item.variantId._id, // Saving the variant ID
            productName: item.productId.name, // Snapshot Name
            image: item.variantId.image,             // Snapshot Image
            productStatus: 'Placed',
            quantity: item.quantity,
            price: price
        });
    }

    // 4. Calculate Final Amount
    const tax = subtotal * 0.05;
    const shipping = subtotal > 100000 ? 0 : 100;
    const discount = 0; // Add coupon logic later if needed
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
            address1: addressDoc.address1, // Ensure these match your Address Model
            address2: addressDoc.address2,
            city: addressDoc.city,
            state: addressDoc.state,
            pincode: addressDoc.pincode
        },
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid', // Assuming Razorpay success handled elsewhere or initially pending
        status: 'Pending',
        orderHistory: [{
            status: 'Pending',
            date: new Date(),
            comment: 'Order Placed'
        }]
    });

      await newOrder.save();

    // 6. Reduce Stock & Clear Cart
    for (const item of cartItems) {
        await Variant.findByIdAndUpdate(item.variantId._id, {
            $inc: { quantity: -item.quantity } // Decrease stock
        });
    }

    await Cart.deleteMany({ userId });

    return res.json({ 
        success: true, 
        message: "Order placed successfully", 
        orderId: newOrder.orderId 
    });


    } catch (error) {
        console.error(error)
         return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const orderSuccess = async (req, res) => {
    try {
        const { orderId } = req.params; // Get ID from URL
        const userId = req.session.user;
        const user = await User.findById(userId)
        // Optional: Fetch order details to show "Thank you for Order #12345"
         const order = await Order.findOne({ orderId });

        res.render("user/orderSuccess", { orderId, order , user });
    } catch (error) {
        res.render("user/404");
    }
}



export default {loadCheckout, placeOrder, orderSuccess};