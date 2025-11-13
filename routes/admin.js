import express from 'express'
const router =  express.Router()
import authController from '../Controller/admin/authController.js'
import adminAuth from '../middleware/adminAuth.js'

router.get('/login',adminAuth.isLogin,authController.loadLogin)
router.post('/login',authController.login)
router.get('/dashboard',adminAuth.checkSession,authController.loadDashboard)


export default router;