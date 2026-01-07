import reviewManagementService from "../../services/admin/reviewManagementService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const getReviewDetails = async (req,res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const data = await reviewManagementService.getReviewManagementService({page, limit})

        res.render('admin/reviewManagement', {
            reviews: data.reviews,
            currentPage: page,
            totalPages: data.totalPages,
            totalReviews: data.totalReviews,
            averageRating: data.averageRating,
            listedReviewsCount: data.listedReviewCount,   
            unlistedReviewsCount: data.unlistedReviewCount, 
            limit: limit
        });
    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const toggleReviewStatus = async (req, res) => {
    try {
        const { reviewId, isListed } = req.body;
        if (!reviewId) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Review ID is required" });
        }

       const data = await reviewManagementService.toggleReviewStatus(reviewId, isListed)

        res.status(StatusCode.OK).json(data);

    } catch (error) {
       res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
};

export default {getReviewDetails, toggleReviewStatus};