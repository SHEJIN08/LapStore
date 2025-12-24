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
import walletController from '../Controller/user/walletController.js';
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
router.post('/home/manageAddress/add',addressController.addAddress)
router.put('/home/manageAddress/set-default/:addressId', addressController.setDefaultAddress);
router.get("/home/manageAddress/get/:addressId", addressController.getAddressDetails);
router.put("/home/manageAddress/edit/:addressId", addressController.editAddress);
router.delete("/home/manageAddress/delete/:addressId", addressController.deleteAddress);

router.get('/home/cart',userAuth.isUserBlocked,cartController.loadCart)
router.post('/home/cart/update-quantity', cartController.updateCartQuantity)
router.delete('/home/cart/remove', cartController.removeFromCart)
router.post("/home/cart/add", cartController.addToCart);

router.get('/cart/checkout',userAuth.isUserBlocked, checkoutController.loadCheckout)
router.post('/create-payment', checkoutController.createPaymentOrder);
router.post('/verify-payment', checkoutController.verifyPayment);
router.post('/cart/checkout/place-order', checkoutController.placeOrder)
router.get('/order-success/:orderId',userAuth.isUserBlocked, checkoutController.orderSuccess)
router.get('/order-failure', userAuth.isUserBlocked, checkoutController.orderFailed)
router.post('/payment-failed', checkoutController.handleFailedPayment);

router.get('/home/orders',userAuth.isUserBlocked, orderController.loadOrders);
router.patch('/orders/cancel', orderController.cancelOrder)
router.get('/home/orders/details/:orderId',userAuth.isUserBlocked, userAuth.checkSession, orderController.orderDetailedPage)
router.post('/orders/return', upload.single('returnImage'), orderController.returnOrder);
router.get('/orders/invoice/:orderId', orderController.downloadInvoice);

router.get('/home/wallet',userAuth.isUserBlocked, walletController.loadWallet)
router.post('/wallet/add-money', userAuth.checkSession, walletController.addMoneyToWallet)
router.post('/wallet/verify-payment', userAuth.checkSession, walletController.verifyWalletPayment)

router.get('/logout',userController.logout);

export default router;