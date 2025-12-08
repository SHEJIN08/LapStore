import express from 'express'
const router = express.Router();
import userAuth from '../middleware/userAuth.js';
import authController from '../Controller/user/authController.js'
import userController from '../Controller/user/userController.js';
import { verifyOtp } from "../Controller/user/otpController.js";
import profileController from '../Controller/user/profileController.js';
import addressController from '../Controller/user/addressController.js';
import cartController from '../Controller/user/cartController.js';
import upload from '../middleware/multer.js'

router.get('/register',userAuth.isLogin,authController.loadRegister)
router.post('/register',authController.registerUser)
router.get("/verify-otp",authController.loadVerifyOtp);
router.post('/verify-otp',verifyOtp)
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
router.get('/home/shop', userController.shopPage)

router.get('/home/profile',userAuth.checkSession ,profileController.loadProfile)
router.post('/home/profile/upload-profile-pic', upload.single('avatar'), profileController.updateProfilePic)
router.put('/home/profile/change-password',profileController.changePassword)
router.put('/home/profile/edit-info', profileController.editInfo)
router.post('/home/profile/verify-update-otp',verifyOtp)

router.get('/home/manageAddress',userAuth.checkSession,addressController.loadAddress)
router.post('/home/manageAddress/add',addressController.addAddress)
router.put('/home/manageAddress/set-default/:addressId', addressController.setDefaultAddress);
router.get("/home/manageAddress/get/:addressId", addressController.getAddressDetails);
router.put("/home/manageAddress/edit/:addressId", addressController.editAddress);
router.delete("/home/manageAddress/delete/:addressId", addressController.deleteAddress);

router.get('/home/cart',cartController.loadCart)
router.post('/home/cart/update-quantity', cartController.updateCartQuantity)
router.delete('/home/cart/remove', cartController.removeFromCart)
router.post("/home/cart/add", cartController.addToCart);

router.get('/logout',userController.logout);

export default router;