import express from 'express'
const router =  express.Router()
import authController from '../Controller/admin/authController.js'
import adminAuth from '../middleware/adminAuth.js'
import productController from '../Controller/admin/productController.js'
import usersController from '../Controller/admin/usersController.js'
import brandController from '../Controller/admin/brandController.js'
import categoryController from '../Controller/admin/categoryController.js'
import orderController from '../Controller/admin/orderContoller.js'
import couponController from '../Controller/admin/couponController.js'
import offerController from '../Controller/admin/offerController.js'
import salesController from '../Controller/admin/salesController.js'
import upload from '../middleware/multer.js'

router.get('/login',adminAuth.isLogin,authController.loadLogin)
router.post('/login',authController.login)

router.get('/dashboard',adminAuth.checkSession,authController.loadDashboard)
router.get('/chart-data', authController.filterChartData)

router.get('/products',adminAuth.checkSession,productController.loadProduct)
router.patch('/products/toggle-block/:id',adminAuth.checkSession,productController.BlockOrUnblock)
router.get('/add-product', adminAuth.checkSession,productController.loadAddProduct)
router.post('/add-product', upload.array('images',5), productController.addProduct);
router.get('/edit-product/:id',adminAuth.checkSession,productController.loadEditProduct);
router.put('/edit-product/:id', upload.array('newImages',5),productController.editProduct)
router.post('/variant/upload-image/:variantId', upload.single('variantImage'),productController.uploadVariantImage)

router.get('/users',adminAuth.checkSession,usersController.loadUsers)
router.get('/users/search', usersController.searchUserForCoupon)
router.post('/users/toggle-block/:id',usersController.BlockOrUnblock)


router.get('/brands',adminAuth.checkSession, brandController.getBrandPage);
router.get('/brands/add',adminAuth.checkSession, brandController.getAddBrandPage);
router.post('/brands/add',adminAuth.checkSession, upload.single('brandLogo'), brandController.addBrand); 
router.get('/brands/edit/:brandId',adminAuth.checkSession, brandController.getEditBrand);
router.patch('/brands/edit/:brandId',adminAuth.checkSession, upload.single('brandLogo'), brandController.editBrand);
router.patch('/brands/toggle-block/:brandId',adminAuth.checkSession, brandController.BlockOrUnblock);

router.get('/category',adminAuth.checkSession,categoryController.loadCategory);
router.post('/category/add-category',adminAuth.checkSession, categoryController.addCategory)
router.get('/category/edit/:id',adminAuth.checkSession, categoryController.getEditCategory);
router.patch('/category/edit/:id',adminAuth.checkSession, categoryController.editCategory); 
router.patch('/category/toggle-status/:id',adminAuth.checkSession, categoryController.getListOrUnlist);

router.get('/orders',orderController.getOrder)
router.get('/orders/details/:orderId', orderController.getOrderDetails);
router.patch('/orders/update-status', orderController.updateOrderStatus);
router.patch('/orders/handle-return', orderController.handleReturnRequest);

router.get('/coupons', couponController.loadCoupon)
router.post('/coupons/create', couponController.createCoupon)
router.get('/coupons/get-details/:id', couponController.getCouponDetails);
router.put('/coupons/edit/:id', couponController.editCoupon);


router.get('/offers', offerController.loadOffers)
router.post('/offers/create', offerController.createOffer)
router.get('/offers/get/:id', offerController.getOfferDetails);
router.put('/offers/edit/:id', offerController.editOffer);
router.get('/products/search', offerController.searchProducts);

router.get('/sales', salesController.loadSalesReport)
router.get('/sales/download', salesController.downloadReport)

router.get('/logout',adminAuth.checkSession,authController.logout)

export default router;