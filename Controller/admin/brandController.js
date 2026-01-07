import brandService from "../../services/admin/brandService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";


const getBrandPage = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;

        const { brands, totalBrands, totalPages } = await brandService.getAllBrandsService({ 
            search, status, page, limit 
        });
    
        res.render('admin/brand', {
            data: brands,
            currentSearch: search,
            currentStatus: status,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
        });

    } catch (error) {
        console.error(error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
            success: false, 
            message: ResponseMessage.SERVER_ERROR
        });
    }
};


const getAddBrandPage = (req, res) => {
    res.render('admin/add-brand');
};


const addBrand = async (req, res) => {
    try {
        const { brandName, country, foundedYear, website, description } = req.body;
        
        if(!req.file){
           return res.status(StatusCode.BAD_REQUEST).json({success: false, message: ResponseMessage.BRAND});
        }
        
        const imageUrl = req.file.url; // path from Cloudinary middleware

     
        await brandService.createBrandService({
            brandName, country, foundedYear, website, description, imageUrl
        });

        return res.status(StatusCode.OK).json({success: true, message: ResponseMessage.NEW_BRAND});

    } catch (err) {
        if (err.message === ResponseMessage.DUP_BRAND) {
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: ResponseMessage.DUP_BRAND});
        }
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
};


const BlockOrUnblock = async (req, res) => {
    try {
        const id = req.params.brandId;
        
        await brandService.toggleBrandStatusService(id);
        
        return res.status(StatusCode.OK).json({success: true, message: ResponseMessage.BRAND_STATUS});

    } catch (err) {
        if (err.message === ResponseMessage.BRAND_NOT_FOUND) {
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: ResponseMessage.BRAND_NOT_FOUND});
        }
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
};


const getEditBrand = async (req, res) => {
    try {
        const brandId = req.params.brandId;
        
        const brand = await brandService.getBrandByIdService(brandId);

        res.render('admin/edit-brand', { brand: brand });

    } catch (error) {
        console.error("Error in getEditBrand:", error);
        return res.redirect('/admin/brands'); 
    }
};

const editBrand = async (req, res) => {
    try {
        const id = req.params.brandId;
        const data = req.body;
        
        // Check for new image
        let newImageUrl = null;
        if (req.file) {
            newImageUrl = req.file.url;
        }

        await brandService.updateBrandService(id, data, newImageUrl);

        return res.status(StatusCode.OK).json({success: true, message: ResponseMessage.BRAND_STATUS});

    } catch (err) {
        if (err.message === ResponseMessage.BRAND_NOT_FOUND) {
            return res.status(StatusCode.NOT_FOUND).json({success: false, message: ResponseMessage.BRAND_NOT_FOUND});
        }
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
};

export default {
    getBrandPage, 
    getAddBrandPage, 
    addBrand, 
    BlockOrUnblock, 
    getEditBrand, 
    editBrand
};