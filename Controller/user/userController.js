import Product from "../../model/productModel.js";
import mongoose from "mongoose";
import Category from "../../model/categoryModel.js";
import Brand from "../../model/brandModel.js"
import Variant from '../../model/variantModel.js'
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const loadHome = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; 
    const limit = 8; // Adjust this number to change items per page
     const skip = (page - 1) * limit;

    const userId = req.session.user;

    console.log(req.query)
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    // 1. Get Query Params (Adding 'brand' here)
    const search = req.query.search || '';
    const sortOption = req.query.sort || "featured";
    const brandOption = req.query.brand || ''; // <--- NEW: Capture the brand

    // 2. Define Initial Match Condition (Published + Search)
    let matchCondition = { isPublished: true };

    if (search) {
      matchCondition.$or = [
        { name: { $regex: search, $options: "i" } }
      ];
    }

    // 3. Define Sort Logic
    let sortStage = { createdAt: -1 };
    if (sortOption === "price-low") {
      sortStage = { minPrice: 1 };
    } else if (sortOption === "price-high") {
      sortStage = { minPrice: -1 };
    }

   // Build the Aggregation Pipeline
    const pipeline = [
      // STAGE 1: Match
      { $match: matchCondition },

      // STAGE 2: Lookup Variants
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "variants",
        },
      },

      // STAGE 3: Calculate Min Price
      {
        $addFields: {
          minPrice: { $min: "$variants.salePrice" },
        },
      },

      // STAGE 4: Lookup Brand
      {
        $lookup: {
          from: 'brands',
          localField: 'brand',
          foreignField: '_id',
          as: 'brandDetails'
        }
      },
      { $unwind: { path: '$brandDetails', preserveNullAndEmptyArrays: true } },

      // STAGE 5: Filter by Brand Name (Dynamic)
      ...(brandOption ? [{
        $match: { "brandDetails.brandName": brandOption }
      }] : []),

      // STAGE 6: Lookup Category
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },

      // STAGE 7: Sort
      { $sort: sortStage },

      // STAGE 8: FACET (The Pagination Magic)
      {
        $facet: {
          // Sub-pipeline 1: Get the actual data
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          // Sub-pipeline 2: Count the total matches
          metadata: [
            { $count: "total" }
          ]
        }
      }
    ];

    // 6. Execute Aggregation
    const result = await Product.aggregate(pipeline);

    const products = result[0].data; 
    const totalProducts = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("user/home", {
      user: userId,
      products: products,
      categories: categories,
      brands: brands,

      currentPage: page,
      totalPages: totalPages,

      currentSort: sortOption,
      currentBrand: brandOption, 
      search: search
    });

  } catch (error) {
    console.error("Home Load Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};
const filterByCategory = async (req, res) => {
   try {
     const page = parseInt(req.query.page) || 1; 
    const limit = 4; // Adjust this number to change items per page
     const skip = (page - 1) * limit;
    const categoryId = req.params.id; 
    const userId = req.session.user;
    
    // 1. Get Sort Option
    const sortOption = req.query.sort || "featured";
    const brandOption = req.query.brand || '';  

    // 2. Define Sort Stage
    let sortStage = { createdAt: -1 }; // Default
    if (sortOption === "price-low") {
      sortStage = { minPrice: 1 };
    } else if (sortOption === "price-high") {
      sortStage = { minPrice: -1 };
    }
   let matchCondition = { 
        isPublished: true,
        // You MUST convert the string ID to an ObjectId for aggregation
        category: new mongoose.Types.ObjectId(String(categoryId)) 
     };

    const categories = await Category.find({ isListed: true });

    const brands = await Brand.find({ isBlocked: false })

   // Build the Aggregation Pipeline
    const pipeline = [
      // STAGE 1: Match
      { $match: matchCondition },

      // STAGE 2: Lookup Variants
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "variants",
        },
      },

      // STAGE 3: Calculate Min Price
      {
        $addFields: {
          minPrice: { $min: "$variants.salePrice" },
        },
      },

      // STAGE 4: Lookup Brand
      {
        $lookup: {
          from: 'brands',
          localField: 'brand',
          foreignField: '_id',
          as: 'brandDetails'
        }
      },
      { $unwind: { path: '$brandDetails', preserveNullAndEmptyArrays: true } },

      // STAGE 5: Filter by Brand Name (Dynamic)
      ...(brandOption ? [{
        $match: { "brandDetails.brandName": brandOption }
      }] : []),

      // STAGE 6: Lookup Category
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },

      // STAGE 7: Sort
      { $sort: sortStage },

      // STAGE 8: FACET (The Pagination Magic)
      {
        $facet: {
          // Sub-pipeline 1: Get the actual data
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          // Sub-pipeline 2: Count the total matches
          metadata: [
            { $count: "total" }
          ]
        }
      }
    ];

    // 6. Execute Aggregation
    const result = await Product.aggregate(pipeline);

    const products = result[0].data; 
    const totalProducts = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);


    // 4. Render the Page
    res.render("user/home", {
      user: userId,
      products: products,
      categories: categories,
      brands: brands,
      
      currentPage: page,
      totalPages: totalPages,

      selectedCat: categoryId, 
      currentSort: sortOption,
      currentBrand: brandOption,

      baseUrl: `/user/category/${categoryId}`
    });

  } catch (error) {
    console.error("Category Filter Error:", error);
   return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR
    });
  }
};

const detailedPage = async (req,res) => {
 try {
  
        const userId = req.session.user;
        const productId = req.params.id;

        // 1. Fetch the specific product using Aggregation
        // We use aggregation to join Variants, Brand, and Category in one go
        const productResult = await Product.aggregate([
            { 
                $match: { 
                    _id: new mongoose.Types.ObjectId(String(productId)),
                    isPublished: true 
                } 
            },
            // Join Variants
            {
                $lookup: {
                    from: "variants",
                    localField: "_id",
                    foreignField: "productId",
                    as: "variants"
                }
            },
            // Join Brand
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand"
                }
            },
            { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
            // Join Category
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

        // Check if product exists
        if (!productResult || productResult.length === 0) {
         return  res.status(StatusCode.NOT_FOUND).json({success: false, message: ResponseMessage.PRODUCT_NOT_FOUND }); 
        }

        const product = productResult[0];

        const relatedProducts = await Product.aggregate([
            {
                $match: {
                    category: product.category._id,
                    _id: { $ne: product._id }, // Exclude current product
                    isPublished: true
                }
            },
            // We need variants for related products to show the price on the card
            {
                $lookup: {
                    from: "variants",
                    localField: "_id",
                    foreignField: "productId",
                    as: "variants"
                }
            },
            // Limit to 4 items
            { $limit: 4 }
        ]);

        // 3. Render the page
        res.render('user/ProductDetailedPage', {
            user: userId,
            product: product,
            relatedProducts: relatedProducts,
            
        });

    } catch (error) {
        console.error("Detailed Page Error:", error);
      return  res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
  }

const logout = async (req, res) => {
    try {
       delete req.session.user;
      return  res.redirect('/user/login'); 
    } catch (error) {
        console.log(error.message);
    }
}
export default { loadHome, logout, filterByCategory, detailedPage };
