import express from 'express'
const router = express.Router();
import userAuth from '../middleware/userAuth.js';
import authController from '../Controller/user/authController.js'
import userController from '../Controller/user/userController.js';
import { verifyOtp } from "../Controller/user/otpController.js";

router.get('/register',userAuth.isLogin,authController.loadRegister)
router.post('/register',authController.registerUser)
router.get("/verify-otp", (req, res) => {
  res.render("user/verifyOtp", {
    message: req.session.message,
    type: req.session.type
  });
  req.session.message = null;
  req.session.type = null;
});
router.post('/verify-otp',verifyOtp)
router.get("/resend-otp",authController.resendOtp);
router.get('/forgot-password',authController.forgotPassword)
router.post('/forgot-password',authController.forgotPasswordPost)
router.get('/reset-password', authController.loadResetPassword)
router.post('/reset-password',authController.resetPasswordPost)
router.get('/login',userAuth.isLogin,authController.loadLogin)
router.post('/login',authController.login)
router.get('/home',userController.loadHome)

export default router;