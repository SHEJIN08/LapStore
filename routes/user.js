import express from 'express'
const router = express.Router();
import userAuth from '../middleware/userAuth.js';
import authController from '../Controller/user/authController.js'
import userController from '../Controller/user/userController.js';


router.get('/login',userAuth.isLogin,authController.loadLogin)
router.get('/register',userAuth.isLogin,authController.loadRegister)
router.post('/register',authController.registerUser)
 router.get('/home',userController.loadHome)

export default router;