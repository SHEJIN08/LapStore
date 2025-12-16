import Product from "../../model/productModel.js";
import Category from "../../model/categoryModel.js";
import Brand from "../../model/brandModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET HOME PAGE DATA ---
const getHomeDataService = async () => {
    // 1. Popular Categories (Limit 4)
    const categories = await Category.find({ isListed: true }).limit(4);

    // 2. Brands
    const brands = await Brand.find({ isBlocked: false });

    // 3. New Arrivals (Aggregation)
    const products = await Product.aggregate([
        { $match: { isPublished: true } },
        {
            $lookup: {
                from: "variants",
                localField: "_id",
                foreignField: "productId",
                as: "variants",
            },
        },
        { $addFields: { minPrice: { $min: "$variants.salePrice" } } },
        {
            $lookup: {
                from: 'brands',
                localField: 'brand',
                foreignField: '_id',
                as: 'brandDetails'
            }
        },
        { $unwind: { path: '$brandDetails', preserveNullAndEmptyArrays: true } },
        { $match: { 'brandDetails.isBlocked': false } },
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryDetails",
            },
        },
        { $unwind: "$categoryDetails" },
        { $match: { "categoryDetails.isListed": true } },
        { $sort: { createdAt: -1 } },
        { $limit: 4 }
    ]);

    return { categories, brands, products };
};

// --- GET PRODUCT DETAILS ---
const getProductDetailsService = async (slug) => {
    // 1. Fetch Product with Joins
    const productResult = await Product.aggregate([
        { 
            $match: { 
                slug: slug,
                isPublished: true 
            } 
        },
        {
            $lookup: {
                from: "variants",
                localField: "_id",
                foreignField: "productId",
                as: "variants"
            }
        },
        {
            $lookup: {
                from: "brands",
                localField: "brand",
                foreignField: "_id",
                as: "brand"
            }
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "category"
            }
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }
    ]);

    if (!productResult || productResult.length === 0) return null;

    const product = productResult[0];

    // Validation Checks
    if (!product.category.isListed || product.brand.isBlocked) {
        return null;
    }

    // 2. Fetch Related Products
    const relatedProducts = await Product.aggregate([
        {
            $match: {
                category: product.category._id,
                _id: { $ne: product._id },
                isPublished: true
            }
        },
        {
            $lookup: {
                from: "variants",
                localField: "_id",
                foreignField: "productId",
                as: "variants"
            }
        },
        { $addFields: { minPrice: { $min: "$variants.salePrice" } } },
        {
            $lookup: {
                from: "brands",
                localField: "brand",
                foreignField: "_id",
                as: "brand"
            }
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        { $limit: 4 }
    ]);

    return { product, relatedProducts };
};

// --- GET SHOP PRODUCTS (Complex Filter) ---
const getShopProductsService = async ({ page, search, sortOption, brandOption, categoryOption, minPrice, maxPrice, limit }) => {
    const skip = (page - 1) * limit;

    // 1. Match Condition
    let matchCondition = { isPublished: true };
    if (search) {
        matchCondition.$or = [{ name: { $regex: search, $options: "i" } }];
    }

    // 2. Sort Logic
    let sortStage = { createdAt: -1 };
    if (sortOption === "price-low") sortStage = { minPrice: 1 };
    else if (sortOption === "price-high") sortStage = { minPrice: -1 };
    else if (sortOption === "a-z") sortStage = { name: 1 };
    else if (sortOption === 'z-a') sortStage = { name: -1 };

    // 3. Pipeline
    const pipeline = [
        { $match: matchCondition },
        {
            $lookup: {
                from: "variants",
                localField: "_id",
                foreignField: "productId",
                as: "variants",
            },
        },
        { $addFields: { minPrice: { $min: "$variants.salePrice" } } },
        { $match: { minPrice: { $gte: minPrice, $lte: maxPrice } } },
        {
            $lookup: {
                from: 'brands',
                localField: 'brand',
                foreignField: '_id',
                as: 'brandDetails'
            }
        },
        { $unwind: { path: '$brandDetails', preserveNullAndEmptyArrays: true } },
        { $match: { 'brandDetails.isBlocked': false } },
        ...(brandOption ? [{ $match: { "brandDetails.brandName": brandOption } }] : []),
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryDetails",
            },
        },
        { $unwind: "$categoryDetails" },
        { $match: { "categoryDetails.isListed": true } },
        ...(categoryOption ? [{ $match: { "categoryDetails.slug": categoryOption } }] : []),
        { $sort: sortStage },
        {
            $facet: {
                data: [{ $skip: skip }, { $limit: limit }],
                metadata: [{ $count: "total" }]
            }
        }
    ];

    const result = await Product.aggregate(pipeline);
    
    const products = result[0].data;
    const totalProducts = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch filters for sidebar
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    return { products, totalPages, categories, brands };
};

export default {
    getHomeDataService,
    getProductDetailsService,
    getShopProductsService
};