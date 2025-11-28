import Product from "../../model/productModel.js";
import mongoose from "mongoose";
import Category from "../../model/categoryModel.js";
import Variant from '../../model/variantModel.js'
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const loadHome = async (req, res) => {
  try {
   const userId = req.session.user;
    const categories = await Category.find({ isListed: true });
    
    // 1. Get Query Params
    const search = req.query.search || '';
    const sortOption = req.query.sort || "featured";

    // 2. Define Match Condition (This combines Published + Search)
    let matchCondition = { isPublished: true };

    if (search) {
        // Add search logic to the existing match condition
        matchCondition.$or = [
            { name: { $regex: search, $options: "i" } } // 'i' means case-insensitive
            // You can add brand search here too if you want:
            // { 'brandDetails.name': { $regex: search, $options: "i" } } (Requires looking up brand BEFORE matching)
        ];
    }

    // 3. Define Sort Logic
    let sortStage = { createdAt: -1 };
    if (sortOption === "price-low") {
      sortStage = { minPrice: 1 };
    } else if (sortOption === "price-high") {
      sortStage = { minPrice: -1 };
    }

    // 4. Run ONE Aggregation Query
    const products = await Product.aggregate([
      // STAGE 1: Apply the Match Condition (Published + Search)
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
          minPrice: { $min: "$variants.price" }, // Ensure this matches your DB field (price vs salePrice)
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
      // Use preserveNullAndEmptyArrays so products without a valid brand don't disappear
      { 
        $unwind: { path: '$brandDetails', preserveNullAndEmptyArrays: true } 
      },

      // STAGE 5: Lookup Category
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },

      // STAGE 6: Sort
      { $sort: sortStage },

      // STAGE 7: Limit results (Note: This might hide search results if they are old)
      // You might want to remove limit or increase it when searching
      { $limit: 8 }, 
    ]);

    res.render("user/home", {
      user: userId,
      products: products,
      categories: categories,
      currentSort: sortOption,
      search: search // Pass search back to view to keep it in the input box
    });

  } catch (error) {
    console.error("Home Load Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};
const filterByCategory = async (req, res) => {
   try {
    const categoryId = req.params.id; // Get the category ID from the URL
    const userId = req.session.user;
    
    // 1. Get Sort Option
    const sortOption = req.query.sort || "featured";

    // 2. Define Sort Stage
    let sortStage = { createdAt: -1 }; // Default
    if (sortOption === "price-low") {
      sortStage = { minPrice: 1 };
    } else if (sortOption === "price-high") {
      sortStage = { minPrice: -1 };
    }

    const categories = await Category.find({ isListed: true });

    const products = await Product.aggregate([
      // STAGE 1: Filter by Category AND Published
      { 
        $match: { 
            isPublished: true, 
            category: new mongoose.Types.ObjectId(String(categoryId)) // : Match specific category
        } 
      },

    
      // STAGE 2: Lookup Variants (To get prices)
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
          minPrice: { $min: "$variants.price" }, 
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
      { 
        $unwind: { path: '$brandDetails', preserveNullAndEmptyArrays: true } 
      },

      
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },

      // STAGE 6: Apply the Sort
      { $sort: sortStage }
    ]);

    // 4. Render the Page
    res.render("user/home", {
      user: userId,
      products: products,
      categories: categories,
      selectedCat: categoryId, 
      currentSort: sortOption 
    });

  } catch (error) {
    console.error("Category Filter Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR
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
            return res.status(StatusCode.NOT_FOUND).json({success: false, message: ResponseMessage.PRODUCT_NOT_FOUND }); 
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
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
  }

const logout = async (req, res) => {
    try {
       delete req.session.user;
        res.redirect('/user/login'); 
    } catch (error) {
        console.log(error.message);
    }
}
export default { loadHome, logout, filterByCategory, detailedPage };
