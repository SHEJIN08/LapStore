
import productService from "../../services/admin/productService.js";
import Review from "../../model/reviewModel.js";
import reviewService from "../../services/user/reviewService.js";
import userService from "../../services/user/userService.js";
import Banner from "../../model/bannerModel.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";


const loadHome = async (req, res) => {
  try {
    const userId = req.session.user;

    const today = new Date();

    const banner = await Banner.findOne({
      isActive: true,
      startDate: {$lte: today},
      endDate: {$gte: today}
    })


    const { categories, brands, products } = await userService.getHomeDataService();

    const reviews = await reviewService.topRateReviewService();

    res.render("user/home", {
      user: userId,
      banner: banner,
      products,
      categories,
      brands,
      reviews: reviews
    });

  } catch (error) {
    console.error("Home Load Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};

// --- PRODUCT DETAILS ---
const detailedPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const slug = req.params.id;

   
    const data = await userService.getProductDetailsService(slug);

    if (!data) {
        
        return res.status(StatusCode.NOT_FOUND).render('user/404');
    }

    const reviews = await reviewService.getProductReviewService(data.product._id)
    const totalReviews = await reviewService.totalReviewCountService(data.product._id)
    const average = await reviewService.averageReviewService(data.product._id)

    res.render('user/ProductDetailedPage', {
        user: userId,
        product: data.product,
        relatedProducts: data.relatedProducts,
        reviews: reviews || [],
        totalReviews,
        average
    });

  } catch (error) {
    console.error("Detailed Page Error:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
  }
};

const shopPage = async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Extract Query Params
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const search = req.query.search || '';
    const sortOption = req.query.sort || "newest";
    const brandOption = req.query.brand || '';
    const categoryOption = req.query.category || '';
    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || 1000000;

 
    const { products, totalPages, categories, brands } = await userService.getShopProductsService({
        page, limit, search, sortOption, brandOption, categoryOption, minPrice, maxPrice
    });

    // Handle AJAX vs Normal Render
    if (req.xhr) {
        return res.render("user/partials/shop-grid", {
            products: products,
            currentPage: page,
            totalPages: totalPages,
            currentSort: sortOption
        });
    } else {
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
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};

// --- LOGOUT ---
const logout = async (req, res) => {
    try {
        delete req.session.user;
        res.redirect('/'); 
    } catch (error) {
        console.log(error.message);
        res.redirect('/');
    }
};

export default { loadHome, logout, detailedPage, shopPage };