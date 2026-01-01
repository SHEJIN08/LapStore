import Order from "../../model/orderModel.js";
import Review from "../../model/reviewModel.js";
import Product from "../../model/productModel.js";

const addReviewService = async (userId, reviewData) => {
    const { productId, rating, comment} = reviewData;

    if(!productId || !rating || !comment){
        throw new Error('All fields (productId, rating, comment) are required')
    }

        const hasPurchased = await Order.findOne({
            userId,
           "orderedItems": { 
            $elemMatch: { 
                productId: productId, 
                productStatus: {$in: ['Delivered', 'Return Rejected']}
            }
        }
        })

        if(!hasPurchased){
            throw new Error('You can only add review when a product is purchased and received')
        }

        const existingReview = await Review.findOne({userId , productId})
        if(existingReview){
            throw new Error('You already have reviewed this product')
        }


        const newReview = new Review({
            userId,
            productId,
            rating,
            comment
        })

        await newReview.save();

        return newReview;
}

const getProductReviewService = async (productId) => {
    const reviews = await Review.find({productId: productId, isListed: true})
        .populate('userId', 'name')
        .sort({createdAt: -1})

        return reviews;
}

const topRateReviewService = async () => {
    const reviews = await Review.find({isListed: true})
    .populate('userId', 'name email')
    .sort({rating: -1, createdAt: -1})
    .limit(3)

    return reviews;
}



export default {addReviewService, getProductReviewService, topRateReviewService}