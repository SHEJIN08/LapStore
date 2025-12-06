import Product from "../../model/productModel.js";
import mongoose from "mongoose";
import Category from "../../model/categoryModel.js";
import userSchema from "../../model/userModel.js";
import Brand from "../../model/brandModel.js"
import Variant from '../../model/variantModel.js'
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const loadHome = async (req, res) => {
  try {
    const userId = req.session.user;

    // 1. Fetch Data for "Popular Categories" Section
    // We limit to 4. If you have a 'popularity' field, you can .sort({ popularity: -1 }) before limiting.
    const categories = await Category.find({ isListed: true }).limit(4);
    
    // 2. Fetch Brands (Keep this if you have a "Our Brands" logo slider on the homepage)
    const brands = await Brand.find({ isBlocked: false });

    // 3. Fetch "New Arrivals" (4 Recent Products)
    // We still use aggregation to calculate the price and ensure the brand/category is active.
    const products = await Product.aggregate([
      // A. Match only published products
      { $match: { isPublished: true } },

      // B. Lookup Variants to get Min Price
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "variants",
        },
      },
      {
        $addFields: {
          minPrice: { $min: "$variants.salePrice" },
        },
      },

      // C. Filter out Blocked Brands
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

      // D. Filter out Unlisted Categories
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

      // E. Sort by Newest & Limit to 4
      { $sort: { createdAt: -1 } },
      { $limit: 4 }
    ]);

    // 4. Render Home
    res.render("user/home", {
      user: userId,
      products: products,     // Just the 4 products
      categories: categories, // Just the 4 categories
      brands: brands,         // All brands (for logo slider)
    });

  } catch (error) {
    console.error("Home Load Error:", error);
    res.status(500).send("Server Error");
  }
};

const detailedPage = async (req,res) => {
 try {
  
        const userId = req.session.user;
        const slug = req.params.id;

        // 1. Fetch the specific product using Aggregation
        // We use aggregation to join Variants, Brand, and Category in one go
        const productResult = await Product.aggregate([
            { 
                $match: { 
                    slug:slug,
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
        
        if(!product.category.isListed){
          return res.status(StatusCode.NOT_FOUND).render('user/404');
        }
        if(product.brand.isBlocked){
          return res.status(StatusCode.NOT_FOUND).render('user/404');
        }
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
              {
                  $addFields: {
                      minPrice: { $min: "$variants.salePrice" } 
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

  const shopPage = async (req,res) => {
 try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6; 
    const skip = (page - 1) * limit;

    const userId = req.session.user;

    // 1. Fetch Sidebar Data (Categories & Brands for the filter lists)
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    // 2. Get Query Parameters
    const search = req.query.search || '';
    const sortOption = req.query.sort || "newest"; // Default to newest
    const brandOption = req.query.brand || '';     // Filter by Brand Name
    const categoryOption = req.query.category || ''; // Filter by Category Slug
    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || 1000000; // High default max

    // 3. Define Initial Match (Published + Search)
    let matchCondition = { isPublished: true };

    if (search) {
      matchCondition.$or = [
        { name: { $regex: search, $options: "i" } }
      ];
    }


    // 4. Define Sort Logic
    let sortStage = { createdAt: -1 }; // Default Newest
    if (sortOption === "price-low") {
      sortStage = { minPrice: 1 };
    } else if (sortOption === "price-high") {
      sortStage = { minPrice: -1 };
    } else if (sortOption === "a-z") {
      sortStage = { name: 1 };
    }else if(sortOption === 'z-a'){
      sortStage = { name: -1 }
    }



    // --- AGGREGATION PIPELINE ---
    const pipeline = [    
      // STAGE 1: Match (Basic Filters)
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

      // STAGE 4: Filter by Price Range
      // IMPORTANT: This must be done AFTER calculating minPrice
      {
        $match: {
          minPrice: { $gte: minPrice, $lte: maxPrice }
        }
      },

      // STAGE 5: Lookup Brand & Filter Blocked
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

      // STAGE 6: Filter by Specific Brand (If selected)
      ...(brandOption ? [{
        $match: { "brandDetails.brandName": brandOption }
      }] : []),

      // STAGE 7: Lookup Category & Filter Unlisted
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

      // STAGE 8: Filter by Specific Category (If selected)
      // Assuming 'categoryOption' is the slug from the URL
      ...(categoryOption ? [{
        $match: { "categoryDetails.slug": categoryOption }
      }] : []),

      // STAGE 9: Sort
      { $sort: sortStage},

      // STAGE 10: Facet (Pagination)
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          metadata: [
            { $count: "total" }
          ]
        }
      }
    ];

    

    // 5. Execute Aggregation
    const result = await Product.aggregate(pipeline);

    const products = result[0].data;
    const totalProducts = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    // 6. Render
  if (req.xhr) {
        // AJAX Request -> Send Partial
        return res.render("partials/shop-grid", {
            products: products,
            currentPage: page,
            totalPages: totalPages,
            currentSort: sortOption
        });
    } else {
        // Normal Request -> Send Full Page
        res.render("user/shop", {
            user: userId,
            products: products,
            categories: categories,
            brands: brands,
            currentPage: page,
            totalPages: totalPages,
            selectedCat: categoryOption,
            currentBrand: brandOption,
            currentSort: sortOption,
            search: search,
            minPrice: minPrice,
            maxPrice: maxPrice
        });
    }
  } catch (error) {
    console.error("Shop Load Error:", error);
    res.status(500).send("Server Error");
  }
  }

const logout = async (req, res) => {
    try {
       delete req.session.user;
      return  res.redirect('/'); 
    } catch (error) {
        console.log(error.message);
    }
}
export default { loadHome, logout,detailedPage, shopPage };
