import Product from "../../model/productModel.js";
import Category from "../../model/categoryModel.js";
import Variant from '../../model/variantModel.js'

const loadHome = async (req, res) => {
  try {
    const userId = req.session.user;

    const categories = await Category.find({ isListed: true });

    const sortOption = req.query.sort || "featured";

    let sortStage = { createdAt: -1 };
    if (sortOption === "price-low") {
      sortStage = { minPrice: 1 };
    } else if (sortOption === "price-hign") {
      sortStage = { minPrice: -1 };
    }

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
      
// create a new field 'minPrice' by taking the minimum of the variants' salePrice
      {
        $addFields: {
          minPrice: {
            $min: "$variants.price", // Finds lowest price in the array
          },
        },
      },

      {
        $lookup: {
            from: 'brands',
            localField: 'brand',
            foreignField: '_id',
            as: 'brandDetails'
        }
      },

      { $unwind: '$brandDetails'},

      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },

      //  Unwind Category (because lookup returns an array)
      { $unwind: "$categoryDetails" },

      // Stage 6: Sort based on user selection
      { $sort: sortStage },

      // Stage 7: Limit results
      { $limit: 8 },
    ]);

    res.render("user/home", {
      user: userId,
      products: products,
      categories: categories,
      currentSort: sortOption,
      user:req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
const filterByCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // 1. Fetch categories for the navbar
        const categories = await Category.find({ isListed: true });

        // 2. Fetch Products matching the category
        const productData = await Product.find({
            isPublished: true,
            category: categoryId
        })
        .populate('category')
        .populate('brand'); // Ensure brand is populated

       
        // We map over the products and fetch their specific variants
        const products = await Promise.all(productData.map(async (product) => {
            const variants = await Variant.find({ productId: product._id });
            
            // Calculate lowest price among variants
            const minPrice = variants.length > 0 
                ? Math.min(...variants.map(v => v.price)) 
                : 0;

            // Convert Mongoose document to a plain object so we can add 'minPrice'
            const productObj = product.toObject();
            productObj.minPrice = minPrice;
            
            return productObj;
        }));

        // 4. Render
        res.render('user/home', {
            products: products, // Now contains minPrice
            categories: categories,
            user: req.session.user,
            selectedCat: categoryId 
        });

    } catch (error) {
        console.log(error.message);
        res.redirect('/');
    }
}
const logout = async (req, res) => {
    try {
        req.session.destroy(); // Destroy session
        res.redirect('/user/login'); 
    } catch (error) {
        console.log(error.message);
    }
}
export default { loadHome, logout, filterByCategory };
