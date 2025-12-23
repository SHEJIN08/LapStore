import offerService from "../../services/admin/offerService.js"
import Offer from "../../model/offerModel.js";
import Category from "../../model/categoryModel.js"
import Product from "../../model/productModel.js"
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";


const loadOffers = async (req,res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;

        const now = new Date();

        const categories = await Category.find({isListed: true})

        const {offers, totalOffers, totalPages} = await offerService.getOfferService({search, status, page, limit})
        const stats = await offerService.getOfferStats();

     res.render('admin/offers', {
            offers,
            categories,
            currentPage: page,
            totalPages,
            totalOffers,
            currentSearch: search,
            currentStatus: status,
            stats: { 
                active: stats.activeCount, 
                inactive: stats.inactiveCount, 
                expired: stats.expiredCount,
                mostUsed: stats.mostUsed
            },
            activePage: 'offers'
        });
    } catch (error) {
        console.error(error)
         res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const createOffer = async (req,res) => {
    try {
        await offerService.createOfferService(req.body)

          return res.status(StatusCode.CREATED).json({success: true, message: 'New offer added successfully'})
    } catch (error) {
         console.error(error)
              if (error.code === 11000) {
                   return res.status(StatusCode.CONFLICT).json({ 
                       success: false, 
                       message: "Offer with this code already exists!" 
                   });
               }
               res.status(StatusCode.BAD_REQUEST).json({ 
                   success: false, 
                   message: error.message || ResponseMessage.SERVER_ERROR 
               });
    }
}

const getOfferDetails = async (req,res) => {
    try {
        const id = req.params.id;

        const offer = await Offer.findById(id).populate('productIds', 'name')

    if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        res.json({ success: true, offer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const editOffer = async (req,res) => {
    try {
        const id = req.params.id;
        await offerService.updateOfferService(id, req.body)
        res.status(StatusCode.OK).json({success: true, message: 'Offer updated successfully'})
    } catch (error) {
        console.error(error )
       res.status(StatusCode.BAD_REQUEST).json({success: false, message: error.message})
    }
}
const searchProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        
        // Find active products that match the name (Limit 10 for speed)
        const products = await Product.find({
            name: { $regex: search, $options: "i" }, // Case-insensitive
            isPublished: true 
        })
        .select("name _id") // Only fetch ID and Name
        .limit(5);

        res.json({ success: true, products });
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ success: false, message: "Error searching products" });
    }
};


export default {loadOffers, createOffer, getOfferDetails, editOffer, searchProducts}