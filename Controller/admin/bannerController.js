import bannerService from "../../services/admin/bannerManagementService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const bannerManagement = async (req,res) => {
    try {
        const banners = await bannerService.getBannerManagementService();

        res.render('admin/bannerManagement', {
            banners: banners
        })
    } catch (error) {
        console.error(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const addBanner = async (req,res) => {
    try {
        if(!req.file){
            res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Banner image is not added'})
        }

        const bannerData = {
            image: req.file.secure_url, 
            title: req.body.title,
            description: req.body.description,
            ctaText: req.body.ctaText,         
            link: req.body.link,              
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            isActive: req.body.isActive === 'true'
        }

        if(!bannerData){
           return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'All fields are required'})
        }

        await bannerService.addBannerService(bannerData);

        res.status(StatusCode.OK).json({success: true, message: 'New Banner created'})

    } catch (error) {
        console.error(error)
         res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

export default {bannerManagement, addBanner}