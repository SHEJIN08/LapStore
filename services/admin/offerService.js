import Offer from "../../model/offerModel.js";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";

const getOfferService = async ({search, status, page, limit}) => {
    try {
        const skip = (page - 1) * limit;
        let query = {};
        const now = new Date();
        const filterStatus = status ? status.toLowerCase() : 'all';

        if (filterStatus === 'active') {
            query.isActive = true;
            query.startDate = { $lte: now }; 
            query.endDate = { $gte: now };
        } 
        else if (filterStatus === 'expired') {
            query.endDate = { $lt: now };
        }
        else if (filterStatus === 'inactive') {
            query.isActive = false;
        }

      if(search){
        const searchRegex = new RegExp(search, 'i')
        query.$or = [
            {offerName: searchRegex},
        ]
    }

   const offers = await Offer.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOffers = await Offer.countDocuments(query);
        const totalPages = Math.ceil(totalOffers / limit);

        return { offers, totalOffers, totalPages };

    } catch (error) {
        throw new Error(error.message);
    }
}

const getOfferStats = async () => {
    try {
        const now = new Date();
        
        const [activeCount, inactiveCount, expiredCount] = await Promise.all([
            Offer.countDocuments({ isActive: true, endDate: { $gte: now }, startDate: { $lte: now } }),
            Offer.countDocuments({ isActive: false, endDate: { $gt: now } }),
            Offer.countDocuments({ endDate: { $lt: now } })
        ]);

        const mostUsedOfferDoc = await Offer.findOne()
            .sort({ usageCount: -1 }) 
            .select('offerName usageCount'); 

            const mostUsed = mostUsedOfferDoc ? mostUsedOfferDoc.offerName : 'N/A';

        return { activeCount, inactiveCount, expiredCount, mostUsed };
    } catch (error) {
        throw new Error("Error fetching stats");
    }
}

const createOfferService = async (data) => {
    try {
        const {offerName, offerType, discountType, discountValue, productIds, categoryId, startDate, endDate, status } = data

        const start = new Date(startDate)
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0)

        if(start < today){
            throw new Error('Start date cannot be in the past');
        }

        if (end <= start) {
            throw new Error('End date must be after the start date');
        }

       let offerData = {
            offerName: offerName,      
            offerType: offerType,      
            discountType: discountType,
            discountValue: Number(discountValue), 
            startDate: start,
            endDate: end,
            isActive: status === 'Active' || status === true || status === 'on'
        };

        if(discountType === 'percentage' && discountValue > 99){
            throw new Error("Discount percentage must be less than 100")
        }

        if(discountType === 'fixed'){
            const fixedVal = Number(discountValue);

            if(offerType === 'product') {
                if(!productIds || productIds.length === 0){
                     throw new Error('Please select at least one product');
                }

                const variants = await Variant.find({productId: {$in: productIds}})

                 if(!variants || variants.length === 0){
                    throw new Error("No variants found for the selected products");
                 }

                 const invalidVariant = variants.find(v => v.salePrice <= fixedVal);
                 
                 if(invalidVariant){
                    throw new Error(`Discount amount (₹${fixedVal}) cannot be greater than the price of product variant (₹${invalidVariant.salePrice})`);
                 }

            }else if(offerType === 'category'){
                if(!categoryId) throw new Error('Please select a category')
                
                const productsInCategory = await Product.find({category: categoryId}).select('_id')

                if(!productsInCategory.length){
                    throw new Error("This category has no products to apply an offer to.");
                }

                const categoryProductsId = productsInCategory.map(s => s._id)

                const categoryVariants = await Variant.find({productId: {$in: categoryProductsId}});
                const invalidVariant = categoryVariants.find(v => v.salePrice <=fixedVal);
                if(invalidVariant){
                  throw new Error(`Discount (₹${fixedVal}) is too high for some items in this category (Lowest Price found: ₹${invalidVariant.salePrice})`);
                }
            }
        }

        if (offerType === 'product') {
            if (!productIds || productIds.length === 0) {
                throw new Error('Please select at least one product');
            }
            offerData.productIds = productIds; 
            offerData.categoryId = null;       
        }else if (offerType === 'category') {
            if (!categoryId) {
                throw new Error('Please select a category');
            }
            offerData.categoryId = categoryId;
            offerData.productIds = [];        
        }

        const newOffer = new Offer(offerData)
        const savedOffer = await newOffer.save();

        return savedOffer
    } catch (error) {
           console.error("Error creating coupon:", error);
        throw new Error(error.message);
    }
}

const updatedOfferService = async (id, data) => {
    try {
        const { offerName, offerType, discountType, discountValue, productIds, categoryId, startDate, endDate, status } = data;

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) {
            throw new Error('End date must be after start date');
        }

        let updateData = {
            offerName,
            offerType,
            discountType,
            discountValue: Number(discountValue),
            startDate: start,
            endDate: end,
            isActive: status === 'Active' || status === true || status === 'on'
        };

        if (discountType === 'percentage' && discountValue > 99) {
            throw new Error("Discount percentage must be less than 100");
        }

        if (discountType === 'fixed') {
            const fixedVal = Number(discountValue);

            if (offerType === 'product') {
                if (!productIds || productIds.length === 0) {
                    throw new Error('Please select at least 1 product');
                }

                // Check variants of specific products
                const variants = await Variant.find({ productId: { $in: productIds } });
                
                if (!variants || variants.length === 0) {
                    throw new Error("No variants found for selected products");
                }

                const invalidVariant = variants.find(v => v.salePrice <= fixedVal);
                if (invalidVariant) {
                    throw new Error(`Discount (₹${fixedVal}) cannot exceed product price (₹${invalidVariant.salePrice})`);
                }

            } else if (offerType === 'category') {
                if (!categoryId) throw new Error('Please select a category');

                // Check variants of all products in category
                const productsInCategory = await Product.find({ category: categoryId }).select('_id');
                
                if (!productsInCategory.length) {
                    throw new Error("This category has no products");
                }

                const categoryProductIds = productsInCategory.map(p => p._id);
                const categoryVariants = await Variant.find({ productId: { $in: categoryProductIds } });

                const invalidVariant = categoryVariants.find(v => v.salePrice <= fixedVal);
                if (invalidVariant) {
                    throw new Error(`Discount (₹${fixedVal}) is too high for category items (Lowest: ₹${invalidVariant.salePrice})`);
                }
            }
        }

        if (offerType === 'product') {
            if (!productIds || productIds.length === 0) {
                throw new Error('Please select at least 1 product');
            }
            updateData.productIds = productIds;
            updateData.categoryId = null;
        } else if (offerType === 'category') {
            if (!categoryId) {
                throw new Error('Please select a category');
            }
            updateData.categoryId = categoryId;
            updateData.productIds = [];
        }

        const updatedOffer = await Offer.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedOffer) {
            throw new Error('Offer not found');
        }

        return updatedOffer;

    } catch (error) {
        console.error("Error updating offer:", error);
        throw new Error(error.message);
    }
}


export default {getOfferService, getOfferStats, createOfferService, updatedOfferService}