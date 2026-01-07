import express from 'express'
const router = express.Router();
import userAuth from '../middleware/userAuth.js';
import authController from '../Controller/user/authController.js'
import userController from '../Controller/user/userController.js';
import otpController from "../Controller/user/otpController.js";
import profileController from '../Controller/user/profileController.js';
import addressController from '../Controller/user/addressController.js';
import cartController from '../Controller/user/cartController.js';
import checkoutController from '../Controller/user/checkoutContoller.js';
import orderController from '../Controller/user/orderContoller.js';
import wishlistController from '../Controller/user/wishlistController.js';
import walletController from '../Controller/user/walletController.js';
import referralController from '../Controller/user/referralController.js';
import reviewController from '../Controller/user/reviewController.js';
import upload from '../middleware/multer.js'

router.get('/register',userAuth.isLogin,authController.loadRegister)
router.post('/register',authController.registerUser)
router.get("/verify-otp",authController.loadVerifyOtp);
router.post('/verify-otp',otpController.verifyOtp)
router.get("/resend-otp",authController.resendOtp);
router.get('/forgot-password',authController.forgotPassword)
router.post('/forgot-password',authController.forgotPasswordPost)
router.get('/reset-password', authController.loadResetPassword)
router.post('/reset-password',authController.resetPasswordPost)
router.get('/login',userAuth.isLogin,authController.loadLogin)
router.post('/login',authController.login)
router.get('/auth/google/callback', (req, res) => {
  return res.render('user/googleCallback'); 
});

router.post('/auth/google/callback', authController.googleCallback); // server handles JSON

router.get('/home',userAuth.isUserBlocked,userController.loadHome)
router.get('/product/:id',userAuth.isUserBlocked, userController.detailedPage)
router.get('/home/shop',userAuth.isUserBlocked, userController.shopPage)

router.get('/home/profile',userAuth.isUserBlocked,userAuth.checkSession ,profileController.loadProfile)
router.post('/home/profile/upload-profile-pic', upload.single('avatar'), profileController.updateProfilePic)
router.put('/home/profile/change-password',profileController.changePassword)
router.put('/home/profile/edit-info', profileController.editInfo)
router.post('/home/profile/verify-update-otp',otpController.verifyOtp)

router.get('/home/manageAddress', userAuth.isUserBlocked, userAuth.checkSession,addressController.loadAddress)
router.post('/home/manageAddress/add',userAuth.isUserBlocked, userAuth.checkSession,addressController.addAddress)
router.put('/home/manageAddress/set-default/:addressId',userAuth.isUserBlocked, userAuth.checkSession, addressController.setDefaultAddress);
router.get("/home/manageAddress/get/:addressId",userAuth.isUserBlocked, userAuth.checkSession, addressController.getAddressDetails);
router.put("/home/manageAddress/edit/:addressId",userAuth.isUserBlocked, userAuth.checkSession, addressController.editAddress);
router.delete("/home/manageAddress/delete/:addressId",userAuth.isUserBlocked, userAuth.checkSession, addressController.deleteAddress);

router.get('/home/cart',userAuth.isUserBlocked,cartController.loadCart)
router.post('/home/cart/update-quantity',userAuth.isUserBlocked, userAuth.checkSession, cartController.updateCartQuantity)
router.delete('/home/cart/remove',userAuth.isUserBlocked, userAuth.checkSession, cartController.removeFromCart)
router.post("/home/cart/add",userAuth.isUserBlocked, cartController.addToCart);

router.get('/cart/checkout',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.loadCheckout)
router.post('/create-payment',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.createPaymentOrder);
router.post('/verify-payment',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.verifyPayment);
router.post('/cart/checkout/place-order',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.placeOrder)
router.get('/order-success/:orderId',userAuth.isUserBlocked, checkoutController.orderSuccess)
router.get('/order-failure',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.orderFailed)
router.post('/payment-failed',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.handleFailedPayment);

router.post('/cart/apply-coupon',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.applyCoupon);
router.post('/cart/remove-coupon',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.removeCoupon);

router.get('/home/orders',userAuth.isUserBlocked, userAuth.checkSession, orderController.loadOrders);
router.patch('/orders/cancel',userAuth.isUserBlocked, userAuth.checkSession, orderController.cancelOrder)
router.get('/home/orders/details/:orderId',userAuth.isUserBlocked, userAuth.checkSession, orderController.orderDetailedPage)
router.post('/orders/return', upload.single('returnImage'),userAuth.isUserBlocked, userAuth.checkSession, orderController.returnOrder);
router.get('/orders/invoice/:orderId',userAuth.isUserBlocked, userAuth.checkSession, orderController.downloadInvoice);

router.post('/repay-failed-order',userAuth.isUserBlocked, userAuth.checkSession, checkoutController.retryFailedPayment);

router.get('/wishlist', userAuth.isUserBlocked, userAuth.checkSession, wishlistController.loadWishlist);
router.post('/wishlist/add',userAuth.isUserBlocked, userAuth.checkSession, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:itemId', userAuth.isUserBlocked, userAuth.checkSession, wishlistController.removeFromWishlist);

router.get('/home/wallet',userAuth.isUserBlocked, userAuth.checkSession, walletController.loadWallet)
router.post('/wallet/add-money', userAuth.isUserBlocked, userAuth.checkSession, walletController.addMoneyToWallet)
router.post('/wallet/verify-payment', userAuth.isUserBlocked, userAuth.checkSession, walletController.verifyWalletPayment)

router.get('/home/referral',userAuth.isUserBlocked, userAuth.checkSession, referralController.loadReferralPage)

router.post('/product/reviews/add', userAuth.isUserBlocked, userAuth.checkSession, reviewController.addReview)
router.get('/product/:productId', reviewController.getProductReviews)


router.get('/logout',userAuth.checkSession,userController.logout);

export default router;