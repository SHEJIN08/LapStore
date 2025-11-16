import express from 'express'
const router =  express.Router()
import authController from '../Controller/admin/authController.js'
import adminAuth from '../middleware/adminAuth.js'
import productController from '../Controller/admin/productController.js'
import usersController from '../Controller/admin/usersController.js'

router.get('/login',adminAuth.isLogin,authController.loadLogin)
router.post('/login',authController.login)
router.get('/dashboard',adminAuth.checkSession,authController.loadDashboard)
router.get('/products',adminAuth.checkSession,productController.loadProduct)
router.get('/users',adminAuth.checkSession,usersController.loadUsers)
router.post('/users/toggle-block/:id',usersController.BlockOrUnblock)
router.post('/users/delete/:id',usersController.DeleteUser)
router.post('/users/edit/:id',usersController.EditUser)
router.get('/logout',adminAuth.checkSession,authController.logout)

export default router;