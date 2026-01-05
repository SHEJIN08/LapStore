import Banner from "../../model/bannerModel.js";

const getBannerManagementService = async () => {
    try {
        const banners = await Banner.find().sort({createdAt: -1});
        return banners;
    } catch (error) {
        throw new Error(error.message)
    }
}

const addBannerService = async (data) => {
    try {
        if(data.isActive){
            await Banner.updateMany({}, {$set: {isActive: false }});
        }
        const newBanner = new Banner(data)
        await newBanner.save()
        return newBanner;
    } catch (error) {
        throw new Error(error.message)
    }
}

const editBannerService = async (id, data) => {
    try {
        const {title, description, ctaText, link, startDate, endDate, isActive, image} = data

        const banner = await Banner.findById(id);

        if(!banner){
            throw new Error('Banner not found');
        }

        if(data.isActive === true){
            await Banner.updateMany({_id: {$ne: id}}, { $set: { isActive: false }})
        }

        banner.title = title;
        banner.description = description;
        banner.ctaText = ctaText;
        banner.link = link;
        banner.startDate = startDate;
        banner.endDate = endDate;
        banner.isActive = isActive;

        if(image){
            banner.image = image;
        }


        await banner.save()

        return banner;
    } catch (error) {
          throw new Error(error.message)
    }
}

export default {getBannerManagementService, addBannerService, editBannerService}