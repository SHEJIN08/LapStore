import Offer from "../../model/offerModel.js";

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
            // Expired = End Date passed
            query.endDate = { $lt: now };
        }
        else if (filterStatus === 'inactive') {
            // Inactive = Toggle switch is off
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
        
        const [activeCount, upcomingCount, expiredCount] = await Promise.all([
            Offer.countDocuments({ isActive: true, endDate: { $gte: now }, startDate: { $lte: now } }),
            Offer.countDocuments({ isActive: true, startDate: { $gt: now } }),
            Offer.countDocuments({ endDate: { $lt: now } })
        ]);

        const mostUsedOfferDoc = await Offer.findOne()
            .sort({ usageCount: -1 }) 
            .select('offerName usageCount'); 

            const mostUsed = mostUsedOfferDoc ? mostUsedOfferDoc.offerName : 'N/A';

        return { activeCount, upcomingCount, expiredCount, mostUsed };
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

const updateOfferService = async (id, data) => {
    try {
        const { offerName, offerType, discountType, discountValue, productIds, categoryId, startDate, endDate, status } = data;

      const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (end <= start) {
            throw new Error('End date must be after start date');
        }

        // 2. Prepare Update Object
        let updateData = {
            offerName,
            offerType,
            discountType,
            discountValue: Number(discountValue),
            startDate: start,
            endDate: end,
            isActive: status === 'Active' || status === true || status === 'on'
        };

        if(offerType === 'product'){
            if(!productIds || productIds.length === 0){
                throw new Error('Please select atleast 1 product')
            }
            updateData.productIds = productIds;
            updateData.categoryId = null;
        }else if(offerType === 'category'){
            if(!categoryId){
                throw new Error('Please select a category')
            }
            updateData.categoryId = categoryId;
            updateData.productIds = [];

            const updateOffer = await Offer.findByIdAndUpdate(id, updateData)
            return updateOffer;
        }
    } catch (error) {
        throw new Error(error.message);
    }
}


export default {getOfferService, getOfferStats, createOfferService, updateOfferService}