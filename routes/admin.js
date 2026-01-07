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
import reviewController from '../Controller/admin/reviewController.js'
import bannerController from '../Controller/admin/bannerController.js'
import upload from '../middleware/multer.js'

router.get('/login',adminAuth.isLogin,authController.loadLogin)
router.post('/login',authController.login)

router.get('/dashboard',adminAuth.checkSession,authController.loadDashboard)
router.get('/dashboard-filter',adminAuth.checkSession, authController.filterDashboardData);
router.get('/chart-data',adminAuth.checkSession, authController.filterChartData)

router.get('/products',adminAuth.checkSession,productController.loadProduct)
router.patch('/products/toggle-block/:id',adminAuth.checkSession,productController.BlockOrUnblock)
router.get('/add-product', adminAuth.checkSession,productController.loadAddProduct)
router.post('/add-product', upload.array('images',5),adminAuth.checkSession, productController.addProduct);
router.get('/edit-product/:id',adminAuth.checkSession,productController.loadEditProduct);
router.put('/edit-product/:id', upload.array('newImages',5),adminAuth.checkSession,productController.editProduct)
router.post('/variant/upload-image/:variantId', upload.single('variantImage'),adminAuth.checkSession,productController.uploadVariantImage)

router.get('/users',adminAuth.checkSession,usersController.loadUsers)
router.get('/users/search', adminAuth.checkSession, usersController.searchUserForCoupon)
router.post('/users/toggle-block/:id',adminAuth.checkSession, usersController.BlockOrUnblock)


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

router.get('/orders',adminAuth.checkSession,orderController.getOrder)
router.get('/orders/details/:orderId',adminAuth.checkSession, orderController.getOrderDetails);
router.patch('/orders/update-status',adminAuth.checkSession, orderController.updateOrderStatus);
router.patch('/orders/handle-return',adminAuth.checkSession, orderController.handleReturnRequest);

router.get('/coupons',adminAuth.checkSession, couponController.loadCoupon)
router.post('/coupons/create',adminAuth.checkSession, couponController.createCoupon)
router.get('/coupons/get-details/:id',adminAuth.checkSession, couponController.getCouponDetails);
router.put('/coupons/edit/:id',adminAuth.checkSession, couponController.editCoupon);


router.get('/offers',adminAuth.checkSession, offerController.loadOffers)
router.post('/offers/create',adminAuth.checkSession, offerController.createOffer)
router.get('/offers/get/:id',adminAuth.checkSession, offerController.getOfferDetails);
router.put('/offers/edit/:id',adminAuth.checkSession, offerController.editOffer);
router.get('/products/search',adminAuth.checkSession, offerController.searchProducts);

router.get('/sales',adminAuth.checkSession, salesController.loadSalesReport)
router.get('/sales/download',adminAuth.checkSession, salesController.downloadReport)

router.get('/reviews',adminAuth.checkSession, reviewController.getReviewDetails)
router.patch('/reviews/toggle-status',adminAuth.checkSession, reviewController.toggleReviewStatus)

router.get('/banners',adminAuth.checkSession, bannerController.bannerManagement)
router.post('/banners/add', upload.single('image'),adminAuth.checkSession, bannerController.addBanner);
router.put('/banners/edit/:id', upload.single('image'),adminAuth.checkSession, bannerController.editBanner)

router.get('/logout',adminAuth.checkSession,authController.logout)

export default router;