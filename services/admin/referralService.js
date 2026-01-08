import mongoose from "mongoose";
import Referral from "../../model/referralModel.js";
import User from "../../model/userModel.js"

const listReferrals = async ({page,limit, search, status}) => {
    try {
        const skip = (page - 1) * limit;
        let query = {};

        if(status){
           const statusFilter = status.charAt(0).toUpperCase() + status.slice(1);
            query.status = statusFilter;
        }
        if(search){
            const matchingUser = await User.find({
                $or: [
                    {name: {$regex: search, $options: "i"}},
                    {email: {$regex: search, $options: "i"}}
                ]
            }).select('_id')

            const userIds = matchingUser.map(user => user._id)
    
            query.referrerId = {$in: userIds}
        }


        const referrals = await Referral.find(query)
         .populate('referrerId', 'name email')
         .populate('refereeId', 'name email')
         .sort({createdAt: -1})
         .skip(skip)
         .limit(limit)

         const totalReferrals = await Referral.countDocuments(query);
         const totalPages = Math.ceil(totalReferrals / limit);

         return {referrals, totalPages, totalReferrals}
    } catch (error) {
        throw new Error(error.message)
    }
}

export default {listReferrals}