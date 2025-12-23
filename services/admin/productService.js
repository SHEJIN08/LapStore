import mongoose from "mongoose";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import Category from "../../model/categoryModel.js";
import Brand from "../../model/brandModel.js";
import Offer from "../../model/offerModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET ALL PRODUCTS (Pagination, Search, Filter) ---
const getAllProductsService = async ({ search, status, page, limit }) => {
    const skip = (page - 1) * limit;
    let query = {};

    if (status === 'active') {
        query.isPublished = true;
    } else if (status === 'blocked') {
        query.isPublished = false;
    }

    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [{ name: searchRegex }];
    }

    const products = await Product.find(query)
        .populate("category")
        .populate("brand")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    return { products, totalProducts, totalPages };
};

// --- GET DATA FOR ADD PRODUCT PAGE ---
const getAddProductDataService = async () => {
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });
    return { categories, brands };
};

// --- TOGGLE PRODUCT STATUS ---
const toggleProductStatusService = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(ResponseMessage.BAD_REQUEST);
    }
    const product = await Product.findById(id);
    if (!product) {
        throw new Error(ResponseMessage.PRODUCT_NOT_FOUND);
    }
    product.isPublished = !product.isPublished;
    await product.save();
    return product;
};

// --- CREATE PRODUCT ---
const createProductService = async (data, imageUrls) => {
    const { name, description, processor, brand, category, variantsData, isPublished, specKeys, specValues, discountAmount } = data;

    // 1. Prepare Specifications
    let specifications = [];
    if (specKeys && specValues) {
        const keys = Array.isArray(specKeys) ? specKeys : [specKeys];
        const values = Array.isArray(specValues) ? specValues : [specValues];
        specifications = keys
            .map((key, index) => ({ key, value: values[index] }))
            .filter((spec) => spec.key !== "");
    }
    if (processor) specifications.push({ key: "Processor", value: processor });

    // 2. Create Product
    const newProduct = new Product({
        name,
        description,
        brand,
        category,
        isPublished: isPublished === "on",
        images: imageUrls,
        specifications,
        productOffer: parseInt(discountAmount) || 0,
    });

    const savedProduct = await newProduct.save();

    // 3. Update Category Count
    await Category.updateOne({ _id: category }, { $inc: { count: 1 } });

    // 4. Create Variants
    if (variantsData) {
        const parsedVariants = JSON.parse(variantsData);
        const flatDiscount = parseFloat(discountAmount) || 0;

        await Promise.all(parsedVariants.map(async (variant) => {
            const regularPrice = parseFloat(variant.price || variant.regularPrice || 0);
            let salePrice = Math.max(0, regularPrice - flatDiscount);

            const newVariant = new Variant({
                productId: savedProduct._id,
                ram: variant.ram,
                storage: variant.storage,
                color: variant.color,
                price: regularPrice,
                stock: variant.stock,
                graphics: variant.graphics,
                sku: `sku-${savedProduct._id}-${Math.floor(Math.random() * 1000)}`,
                regularPrice,
                salePrice
            });

            await newVariant.save();
        }));
    }

    return savedProduct;
};

// --- GET EDIT PRODUCT DATA ---
const getEditProductDataService = async (id) => {
    const product = await Product.findById(id);
    if (!product) throw new Error(ResponseMessage.PRODUCT_NOT_FOUND);

    let variants = await Variant.find({ productId: id });

    // Process Variants (Fallback Logic)
    variants = variants.map(v => {
        const variantObj = v.toObject();
        if (!variantObj.regularPrice && variantObj.price) {
            variantObj.regularPrice = variantObj.price;
        }
        if (!variantObj.salePrice) {
            const discount = product.productOffer || 0;
            variantObj.salePrice = Math.max(0, (variantObj.regularPrice || 0) - discount);
        }
        return variantObj;
    });

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    return { product, variants, categories, brands };
};

// --- UPLOAD VARIANT IMAGE ---
const updateVariantImageService = async (variantId, imageUrl) => {
    const updatedVariant = await Variant.findByIdAndUpdate(
        variantId,
        { image: imageUrl },
        { new: true }
    );
    if (!updatedVariant) throw new Error(ResponseMessage.VARIANT_NOT_FOUND);
    return updatedVariant;
};

// --- UPDATE PRODUCT (Comprehensive) ---
const updateProductService = async (id, data, newImageUrls) => {
    const { name, description, brand, category, specKeys, specValues, variantsData, deletedImages, discountAmount } = data;

    const product = await Product.findById(id);
    if (!product) throw new Error(ResponseMessage.PRODUCT_NOT_FOUND);

    // 1. Handle Category Change Count
    if (product.category.toString() !== category) {
        await Category.updateOne({ _id: product.category }, { $inc: { count: -1 } });
        await Category.updateOne({ _id: category }, { $inc: { count: 1 } });
    }

    // 2. Update Basic Fields
    product.name = name;
    product.description = description;
    product.brand = brand;
    product.category = category;
    
    const flatDiscount = parseFloat(discountAmount) || 0;
    product.productOffer = flatDiscount;

    // 3. Update Specifications
    let specifications = [];
    if (specKeys && specValues) {
        const keys = Array.isArray(specKeys) ? specKeys : [specKeys];
        const values = Array.isArray(specValues) ? specValues : [specValues];
        specifications = keys
            .map((key, index) => ({ key, value: values[index] }))
            .filter((spec) => spec.key !== "");
    }
    product.specifications = specifications;

    // 4. Handle Images (Delete & Add)
    if (deletedImages) {
        const imagesToRemove = JSON.parse(deletedImages);
        product.images = product.images.filter(img => !imagesToRemove.includes(img));
    }
    if (newImageUrls && newImageUrls.length > 0) {
        product.images.push(...newImageUrls);
    }

    await product.save();

    // 5. Sync Variants
    if (variantsData) {
        const parsedVariants = JSON.parse(variantsData);
        
        // Delete removed variants
        const sentVariantIds = parsedVariants.filter(v => v._id).map(v => v._id);
        await Variant.deleteMany({
            productId: id,
            _id: { $nin: sentVariantIds }
        });

        // Update/Create variants
        for (const v of parsedVariants) {
            let regularPrice = parseFloat(v.price || v.regularPrice || 0);
            let salePrice = Math.max(0, regularPrice - flatDiscount);

            const variantData = {
                ram: v.ram,
                storage: v.storage,
                color: v.color,
                stock: v.stock,
                graphics: v.graphics,
                regularPrice,
                salePrice
            };

            if (v._id) {
                await Variant.findByIdAndUpdate(v._id, variantData);
            } else {
                const newVariant = new Variant({
                    productId: id,
                    ...variantData,
                    sku: `sku-${Date.now()}-${Math.floor(Math.random() * 1000)}`
                });
                await newVariant.save();
            }
        }
    }
    
    return true;
};

export const calculateProductDiscount = async (product) => {
    const now = new Date()

    const productOffer = await Offer.findOne({
        offerType: 'product',
        productIds: product._id,
        isActive: true,
        startDate: { $lte: now},
        endDate: { $gte: now}
    }).sort({discountValue: -1})

    const categoryOffer = await Offer.findOne({
        offerType: 'category',
        categoryId: product.category,
        isActive: true,
         startDate: { $lte: now},
        endDate: { $gte: now}
    }).sort({discountValue: -1})

    const calculateSavings = (offer) => {
        if(!offer) return 0;
        if(offer.discountType === 'percentage'){
            return (product.regularPrice * offer.discountValue)/ 100
        }else if(offer.discountType === 'fixed'){
            return offer.discountValue
        }
    }

    const productSavings = calculateSavings(productOffer)
    const categorySavings = calculateSavings(categoryOffer)

    let bestOffer = null;
    let discountAmount = 0;

    if(productSavings >= categorySavings && productSavings > 0){
        bestOffer = productOffer;
        discountAmount=productSavings
    }else if(categorySavings >= productSavings && categorySavings > 0){
        bestOffer = categoryOffer;
        discountAmount = categorySavings;
    }

    const finalPrice = Math.max(0, product.regularPrice - discountAmount)

    return {
        finalPrice: Math.round(finalPrice),
        discountAmount: Math.round(discountAmount),
        offerId: bestOffer ? bestOffer._id : null,
        regularPrice: product.regularPrice
    };

}

export default {
    getAllProductsService,
    getAddProductDataService,
    toggleProductStatusService,
    createProductService,
    getEditProductDataService,
    updateVariantImageService,
    updateProductService,
    calculateProductDiscount
};