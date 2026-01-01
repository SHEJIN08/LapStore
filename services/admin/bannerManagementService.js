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
        const newBanner = new Banner(data)
        await newBanner.save()
        return newBanner;
    } catch (error) {
        throw new Error(error.message)
    }
}

export default {getBannerManagementService, addBannerService}