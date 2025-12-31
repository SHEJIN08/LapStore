import reviewService from "../../services/user/reviewService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const addReview = async (req,res) => {
    try {
        const userId = req.session.user;
        console.log(userId)
        if(!req.session || !req.session.user) {
            return res.status(StatusCode.UNAUTHORIZED).json({success: false, message: 'Please log in to add a review'})
        }
        const reviewData = req.body;

        const newReview = await reviewService.addReviewService(userId, reviewData);

        res.status(StatusCode.CREATED).json({success: true, message: 'New review added', review: newReview})
    } catch (error) {
        console.error(error)
        res.status(StatusCode.BAD_REQUEST).json({success: false, message: error.message || 'Failed to add review'})
    }
}

const getProductReviews = async (req,res) => {
    try {
        const {productId} = req.params;
        const reviews = await reviewService.getProductReviewService(productId)

        res.status(StatusCode.OK).json({success: true, reviews})
    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

export default {addReview, getProductReviews}