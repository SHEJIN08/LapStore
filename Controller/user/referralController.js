import referralService from "../../services/user/referralService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadReferralPage = async (req,res) => {
    try {
        const userId = req.session.user;

        const {user,referrals, totalEarnings, successfulCount} = await referralService.userReferrerData(userId)

        res.render('user/referral', {
            user,
            referrals,
            totalEarnings,
            successfulCount,
            referralLink: `${req.protocol}://${req.get('host')}/user/register?ref=${user.referralCode}`
        })
      
    } catch (error) {
        console.log(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

export default {loadReferralPage}