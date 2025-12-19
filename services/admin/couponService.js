import Coupon from "../../model/couponModel.js";

const loadCoupon = async ({search, status, page, limit}) => {
    const skip = (page-1) * limit;
    let query = {};

    if(status ==='active'){
        query.isActive = true;
        query.endDate = { $gte: new Date() };
    }else if(status === 'inactive'){
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
     
    const start = new Date(startDate);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (start < today) {
            throw new Error('Start date cannot be in the past');
        }

    const newCoupon = new Coupon({
            code: code,
            name: name || code, 
            description: description,
            type: couponType, 
            discountValue: discountValue,          
            minPurchaseAmount: minOrderValue || 0,           
            usageLimitPerUser: limitPerUser || 1,
            totalUsageLimit: totalUsageLimit || null,
            
            
            userEligibility: userEligibility || 'all',
            specificUsers: userEligibility === 'specific' ? specificUsers : [],
       
            startDate: start,
            endDate: new Date(endDate),

            isActive: status === 'Active' || status === true || status === 'on'
        });

    const savedCoupon = await newCoupon.save();

    return savedCoupon
    } catch (error) {
     
        console.error("Error creating coupon:", error);
        throw new Error(error.message);
    }
}

// 1. GET COUPON BY ID (Needed for filling the modal)
const getCouponById = async (id) => {
    try {
        // We populate 'specificUsers' so we can show their names in the modal tags
        return await Coupon.findById(id).populate('specificUsers', 'name email');
    } catch (error) {
        throw new Error("Coupon not found");
    }
};

// 2. UPDATE COUPON (Needed for saving changes)
const updateCouponService = async (id, data) => {
    try {
        const {
            code, name, couponType, discountValue, description,
            minOrderValue, limitPerUser, totalUsageLimit,
            userEligibility, specificUsers, startDate, endDate, status
        } = data;

        // Check if code exists (excluding the current coupon ID)
        const existingCoupon = await Coupon.findOne({ 
            code: code, 
            _id: { $ne: id } 
        });

        if (existingCoupon) {
            throw new Error("Coupon code already exists");
        }

        const updateData = {
            code,
            name: name || code,
            description,
            type: couponType,
            discountValue,
            minPurchaseAmount: minOrderValue || 0,
            usageLimitPerUser: limitPerUser || 1,
            totalUsageLimit: totalUsageLimit || null,
            userEligibility,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive: status === 'Active' || status === true || status === 'on'
        };

        // Handle specific users list
        if (userEligibility === 'specific') {
            updateData.specificUsers = specificUsers;
        } else {
            updateData.specificUsers = [];
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(id, updateData, { new: true });
        return updatedCoupon;

    } catch (error) {
        throw new Error(error.message);
    }
};

export default {loadCoupon, createCouponService, getCouponById, updateCouponService}