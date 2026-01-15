import Order from "../../model/orderModel.js";
import Review from "../../model/reviewModel.js";
import Product from "../../model/productModel.js";

const addReviewService = async (userId, reviewData) => {
  const { productId, rating, comment } = reviewData;

  if (!productId || !rating || !comment) {
    throw new Error("All fields (productId, rating, comment) are required");
  }

  const hasPurchased = await Order.findOne({
    userId,
    orderedItems: {
      $elemMatch: {
        productId: productId,
        productStatus: { $in: ["Delivered", "Return Rejected"] },
      },
    },
  });

  if (!hasPurchased) {
    throw new Error(
      "You can only add review when a product is purchased and received"
    );
  }

  const existingReview = await Review.findOne({ userId, productId });
  if (existingReview) {
    throw new Error("You already have reviewed this product");
  }

  const newReview = new Review({
    userId,
    productId,
    rating,
    comment,
  });

  await newReview.save();

  return newReview;
};

const getProductReviewService = async (productId) => {
  const reviews = await Review.find({ productId: productId, isListed: true })
    .populate("userId", "name")
    .sort({ createdAt: -1 });

  return reviews;
};

const topRateReviewService = async () => {
  const reviews = await Review.find({ isListed: true })
    .populate("userId", "name email")
    .sort({ rating: -1, createdAt: -1 })
    .limit(3);

  return reviews;
};

const totalReviewCountService = async (productId) => {
  const totalReviews = await Review.countDocuments({
    productId: productId,
    isListed: true,
  });

  return totalReviews;
};

const averageReviewService = async (productId) => {
  try {
    const reviews = await Review.find({
      productId: productId,
      isListed: true,
    }).select("rating");

    if (reviews.length === 0) return 0;

    const totalReviews = reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );

    const average = parseFloat((totalReviews / reviews.length).toFixed(1));

    await Product.findByIdAndUpdate(productId, { rating: average });

    return average;
  } catch (error) {
    throw new Error(error);
  }
};

export default {
  addReviewService,
  getProductReviewService,
  topRateReviewService,
  totalReviewCountService,
  averageReviewService,
};
