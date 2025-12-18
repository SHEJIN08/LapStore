import Coupon from "../../model/couponModel.js";

const loadCoupon = async ({search, status, page, limit}) => {
    const skip = (page-1) * limit;
    let query = {};

    if(status='active'){
        query.isActive = true;
        query.endDate = { $gte: new Date() };
    }else if(status = 'inactive'){
        query.isActive = false;
    }else if (status === 'expired') {
        query.endDate = { $lt: new Date() }; // Expired
    }

    if(search){
        const searchRegex = new RegExp(search, 'i')
        query.$or = [
            {code: searchRegex},
            { name: searchRegex }
        ]
    }
    const coupons = await Coupon.find(query)
         .sort({createdAt: -1})
         .skip(skip)
         .limit(limit)

             const totalCoupons = await Coupon.countDocuments(query);
             const totalPages = Math.ceil(totalCoupons / limit);

         return {coupons, totalCoupons, totalPages}
}

const createCouponService = async (data) => {
    try{
    const {code,name, couponType, discountValue, description, limitPerUser, totalUsageLimit,userEligibility,specificUsers, startDate,minOrderValue, endDate, status} = data

    const newCoupon = new Coupon({
            code: code,
            name: name || code, 
            description: description,
            type: couponType, 
            minOrderValue: minOrderValue,
            discountValue: discountValue,          
            minPurchaseAmount: minOrderValue || 0,           
            usageLimitPerUser: limitPerUser || 1,
            totalUsageLimit: totalUsageLimit || null,
            
            
            userEligibility: userEligibility || 'all',
            specificUsers: userEligibility === 'specific' ? specificUsers : [],
       

            startDate: new Date(startDate),
            endDate: new Date(endDate),
            
            // Ensure status is a boolean
            isActive: status === 'Active' || status === true || status === 'on'
        });

    const savedCoupon = await newCoupon.save();

    return savedCoupon
    } catch (error) {
     
        console.error("Error creating coupon:", error);
        throw new Error(error.message);
    }
}

export default {loadCoupon, createCouponService}