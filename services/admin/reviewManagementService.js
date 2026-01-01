import Review from "../../model/reviewModel.js";

const getReviewManagementService = async ({page, limit}) => {

    const skip = (page-1) * limit;

    const reviews = await Review.find()
      .populate('userId', 'name email')
      .populate('productId', 'name')
      .sort({createdAt: -1})
      .skip(skip)
      .limit(limit)


      const totalReviews = await Review.countDocuments();

      const aggResult = await Review.aggregate([
        { $group: {_id: null, avgRating: {$avg: '$rating'}}}
      ])
      const averageRating = aggResult.length > 0 ? aggResult[0].avgRating.toFixed(1) : "0.0";

      const listedReviewCount = await Review.countDocuments({isListed: true})
      const unlistedReviewCount = totalReviews - listedReviewCount;


      const totalPages = Math.ceil(totalReviews / limit);

      return {reviews, averageRating, listedReviewCount, unlistedReviewCount, totalPages, totalReviews}
}

const toggleReviewStatus = async (reviewId, isListed) => {
    try {
        await Review.findByIdAndUpdate(reviewId, { isListed: isListed });
       return { success: true, message: "Review status updated successfully" };
    } catch (error) {
        throw new Error(error.message)
    }
};

export default {getReviewManagementService, toggleReviewStatus}