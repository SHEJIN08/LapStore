import productService from "../../services/admin/productService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";
import dotenv from 'dotenv';
dotenv.config();

// --- LOAD PRODUCTS PAGE ---
const loadProduct = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const { products, totalProducts, totalPages } = await productService.getAllProductsService({ 
            search, status, page, limit 
        });

        res.render("admin/products", {
            products,
            currentSearch: search,
            currentStatus: status,
            currentPage: page,
            totalPages,
            totalProducts
        });
    } catch (error) {
        console.log(error.message);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- LOAD ADD PRODUCT PAGE ---
const loadAddProduct = async (req, res) => {
    try {
        const { categories, brands } = await productService.getAddProductDataService();
        res.render("admin/add-product", { cat: categories, brand: brands });
    } catch (err) {
        console.error(err);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- BLOCK / UNBLOCK ---
const BlockOrUnblock = async (req, res) => {
    try {
        const id = req.params.id;
        await productService.toggleProductStatusService(id);
        
        return res.status(StatusCode.OK).json({ success: true, message: ResponseMessage.PRODUCT_STATUS });
    } catch (err) {
        if (err.message === ResponseMessage.BAD_REQUEST || err.message === ResponseMessage.PRODUCT_NOT_FOUND) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: err.message });
        }
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- ADD PRODUCT ---
const addProduct = async (req, res) => {
    try {
        const imageUrls = req.files ? req.files.map((file) => file.secure_url) : [];
        
        await productService.createProductService(req.body, imageUrls);

        return res.status(StatusCode.CREATED).json({ success: true, message: ResponseMessage.PRODUCT });
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- LOAD EDIT PAGE ---
const loadEditProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

        if (!CLOUD_NAME) console.error('CLOUDINARY_CLOUD_NAME is missing');

        const { product, variants, categories, brands } = await productService.getEditProductDataService(id);

        res.render('admin/edit-product', {
            product,
            variants,
            categories,
            brands,
            cloudinaryCloudName: CLOUD_NAME
        });
    } catch (err) {
        if (err.message === ResponseMessage.PRODUCT_NOT_FOUND) {
             return res.status(StatusCode.NOT_FOUND).json({ success: false, message: ResponseMessage.PRODUCT_NOT_FOUND });
        }
        console.error("Error while loading edit page", err);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- UPLOAD VARIANT IMAGE ---
const uploadVariantImage = async (req, res) => {
    try {
        const variantId = req.params.variantId;
        const file = req.file;

        if (!file) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.VAR_PIC });
        }

        const image = await productService.updateVariantImageService(variantId, file.secure_url);

        return res.status(StatusCode.OK).json({
            success: true,
            message: ResponseMessage.VAR_IMG_SUC,
            image: image.image
        });
    } catch (error) {
        if (error.message === ResponseMessage.VARIANT_NOT_FOUND) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: error.message });
        }
        console.error("Error uploading variant image:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- EDIT PRODUCT ---
const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        
        // Extract new images if uploaded
        const newImageUrls = req.files && req.files.length > 0 
            ? req.files.map(file => file.secure_url) 
            : [];

        await productService.updateProductService(id, req.body, newImageUrls);

        res.status(StatusCode.OK).json({ success: true, message: ResponseMessage.PRODUCT_STATUS });

    } catch (error) {
        if (error.message === ResponseMessage.PRODUCT_NOT_FOUND) {
            return res.status(StatusCode.NOT_FOUND).json({ success: false, message: ResponseMessage.VARIANT_NOT_FOUND });
        }
        console.error("Error updating product:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

export default { 
    loadProduct, 
    addProduct, 
    loadAddProduct, 
    BlockOrUnblock, 
    loadEditProduct, 
    editProduct, 
    uploadVariantImage 
};