import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import Category from "../../model/categoryModel.js";
import Brand from "../../model/brandModel.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

// Load Product List (Admin)
const loadProduct = async (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || 'all';

    // Pagination logic
    const page = Number.parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    let query = {};

    if (status === 'active') {
      query.isPublished = true;
    } else if (status === 'blocked') {
      query.isPublished = false;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [{ name: searchRegex }]
    }

    const products = await Product.find(query)
      .populate("category")
      .populate("brand")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(query); // Added query here for accurate count
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("admin/products", {
      products: products,
      currentSearch: search,
      currentStatus: status,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts
    });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// Load Add Product Page
const loadAddProduct = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    res.render("admin/add-product", { cat: category, brand: brand });
  } catch (err) {
    console.error(err);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// Block or Unblock Product
const BlockOrUnblock = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.BAD_REQUEST });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.PRODUCT_NOT_FOUND });
    }
    product.isPublished = !product.isPublished;
    await product.save();
    return res.status(StatusCode.OK).json({ success: true, message: ResponseMessage.PRODUCT_STATUS })
  } catch (err) {
    console.error(err);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// Add New Product Logic
const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      processor,
      brand,
      category,
      variantsData,
      isPublished,
      specKeys,
      specValues,
      discountAmount
    } = req.body;

    const images = req.files ? req.files.map((file) => file.secure_url) : [];

    let specifications = [];
    if (specKeys && specValues) {
      const keys = Array.isArray(specKeys) ? specKeys : [specKeys];
      const values = Array.isArray(specValues) ? specValues : [specValues];

      specifications = keys
        .map((key, index) => ({
          key: key,
          value: values[index],
        }))
        .filter((spec) => spec.key !== "");
    }

    if (processor) {
      specifications.push({ key: "Processor", value: processor });
    }

    const newProduct = new Product({
      name,
      description,
      brand: brand,
      category: category,
      isPublished: isPublished === "on",
      images: images,
      specifications: specifications,
      productOffer: parseInt(discountAmount) || 0,
    });

    const savedProduct = await newProduct.save();
    await Category.updateOne({ _id: category }, { $inc: { count: 1 } });

    if (variantsData) {
      const parsedVariants = JSON.parse(variantsData);
      const flatDiscount = parseFloat(discountAmount) || 0;

      await Promise.all(parsedVariants.map(async (variant) => {
        // Ensure regularPrice is a number. Default to 0 if missing.
        const regularPrice = parseFloat(variant.price|| variant.regularPrice || 0);
        
        let salePrice = regularPrice - flatDiscount;
        if (salePrice < 0) salePrice = 0;

        
        const newVariant = new Variant({
          productId: savedProduct._id,
          ram: variant.ram,
          storage: variant.storage,
          color: variant.color,
          price: regularPrice, // Keep price for consistency
          stock: variant.stock,
          graphics: variant.graphics,
          sku: `sku-${savedProduct._id}-${Math.floor(Math.random() * 1000)}`,
          
          // SAVE BOTH PRICES
          
          regularPrice: regularPrice,
          salePrice: salePrice
        });

        await newVariant.save();
      }));
    }

    return res
      .status(StatusCode.CREATED)
      .json({ success: true, message: ResponseMessage.PRODUCT });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// Load Edit Product Page
const loadEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const CLOUD_NAME =  process.env.CLOUDINARY_CLOUD_NAME;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: ResponseMessage.PRODUCT_NOT_FOUND })
    }
    if(!CLOUD_NAME){
      console.error('CLOUDINARY_CLOUD_NAME is not send')
    }

    let variants = await Variant.find({ productId: id });

    variants = variants.map(v => {
      const variantObj = v.toObject();

      // Fallback: If regularPrice is missing, try to use 'price'
      if (!variantObj.regularPrice && variantObj.price) {
        variantObj.regularPrice = variantObj.price;
      }

      // Fallback: If salePrice is missing, calculate it now based on current offer
      if (!variantObj.salePrice) {
        const discount = product.productOffer || 0;
        variantObj.salePrice = (variantObj.regularPrice || 0) - discount;
        if(variantObj.salePrice < 0) variantObj.salePrice = 0;
      }

      return variantObj;
    });

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    res.render('admin/edit-product', {
      product: product,
      variants: variants,
      categories: categories,
      brands: brands,
      cloudinaryCloudName : CLOUD_NAME
    })
  } catch (err) {
    console.error("Error while loading edit page", err)
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR })
  }
}

// Upload Variant Image
const uploadVariantImage = async (req, res) => {
  try {
    const variantId = req.params.variantId;
    const file = req.file;

    if (!file) {
      return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.VAR_PIC });
    }

    const updatedVariant = await Variant.findByIdAndUpdate(
      variantId,
      { image: file.secure_url },
      { new: true }
    );

    if (!updatedVariant) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: ResponseMessage.VARIANT_NOT_FOUND });
    }

    return res.status(StatusCode.OK).json({
      success: true,
      message: ResponseMessage.VAR_IMG_SUC,
      image: file.secure_url
    });

  } catch (error) {
    console.error("Error uploading variant image:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// Edit Product Logic
const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name,
      description,
      brand,
      category,
      specKeys,
      specValues,
      variantsData,
      deletedImages,
      discountAmount
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: ResponseMessage.VARIANT_NOT_FOUND })
    }

    const oldCategoryId = product.category.toString();
    const newCategoryId = category;

    if (oldCategoryId !== newCategoryId) {
      await Category.updateOne({ _id: oldCategoryId }, { $inc: { count: -1 } });
      await Category.updateOne({ _id: newCategoryId }, { $inc: { count: 1 } });
    }

    product.name = name;
    product.description = description;
    product.brand = brand;
    product.category = newCategoryId;

    const flatDiscount = parseFloat(discountAmount) || 0;
    product.productOffer = flatDiscount;

    let specifications = [];
    if (specKeys && specValues) {
      const keys = Array.isArray(specKeys) ? specKeys : [specKeys];
      const values = Array.isArray(specValues) ? specValues : [specValues];

      specifications = keys.map((key, index) => ({
        key: key,
        value: values[index]
      })).filter(spec => spec.key !== "");
    }
    product.specifications = specifications;

    if (deletedImages) {
      const imagesToRemove = JSON.parse(deletedImages);
      product.images = product.images.filter(img => !imagesToRemove.includes(img));
    }

    if (req.files && req.files.length > 0) {
      const newImageFiles = req.files.map(file => file.secure_url);
      product.images.push(...newImageFiles);
    }

    await product.save();

    // --- D. HANDLE VARIANTS SYNC ---
    if (variantsData) {
      const parsedVariants = JSON.parse(variantsData);

      const sentVariantIds = parsedVariants
        .filter(v => v._id)
        .map(v => v._id);

      await Variant.deleteMany({
        productId: id,
        _id: { $nin: sentVariantIds }
      });

      for (const v of parsedVariants) {
        
        // 🔴 FIX: Logic to handle prices correctly
        // Use v.price (from new input) or v.regularPrice (from existing).
        let regularPrice = parseFloat(v.price || v.regularPrice || 0);
        
        let salePrice = regularPrice - flatDiscount;
        if (salePrice < 0) salePrice = 0;

        const variantData = {
          ram: v.ram,
          storage: v.storage,
          color: v.color,
          stock: v.stock,
          graphics: v.graphics,
          
          // Save Correct Prices
          
          regularPrice: regularPrice,
          salePrice: salePrice
        };

        if (v._id) {
          // UPDATE Existing Variant
          await Variant.findByIdAndUpdate(v._id, variantData);
        } else {
          // CREATE New Variant
          const newVariant = new Variant({
            productId: id,
            ...variantData, // Saves price, regularPrice, salePrice
            sku: `sku-${Date.now()}-${Math.floor(Math.random() * 1000)}`
          });
          await newVariant.save();
        }
      }
    }

    res.status(StatusCode.OK).json({ success: true, message: ResponseMessage.PRODUCT_STATUS });

  } catch (error) {
    console.error("Error updating product:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

export default { loadProduct, addProduct, loadAddProduct, BlockOrUnblock, loadEditProduct, editProduct, uploadVariantImage };