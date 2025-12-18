import couponService from "../../services/admin/couponService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadCoupon = async (req,res) => {
   try{
     const search = req.query.search || '';
        const status = req.query.status || 'all';
        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;

       const { coupons, totalCoupons, totalPages } = await couponService.loadCoupon({search, status, page, limit})
   
       res.render('admin/coupons', {
        coupons,
        currentSearch: search,
        currentStatus: status,
        currentPage : page,
        totalCoupons: totalCoupons,
        totalPages:totalPages
       })
   }catch(error){
    console.error(error)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
   }
}

const createCoupon = async (req,res) => {
    try {
        await couponService.createCouponService(req.body);

        return res.status(StatusCode.CREATED).json({success: true, message: 'New coupon added successfully'})
    } catch (error) {
        console.error(error)
       if (error.code === 11000) {
            return res.status(StatusCode.CONFLICT).json({ 
                success: false, 
                message: "Coupon with this code already exists!" 
            });
        }
        res.status(StatusCode.BAD_REQUEST).json({ 
            success: false, 
            message: error.message || ResponseMessage.SERVER_ERROR 
        });
    }
}

export default {loadCoupon, createCoupon};