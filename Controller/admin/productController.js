import mongoose from "mongoose";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import Category from "../../model/categoryModel.js";
import Brand from "../../model/brandModel.js";

const loadProduct = async (req, res) => {
  try {
        const search = req.query.search || '';
        const status = req.query.status || 'all';

         // Pagination logic
        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        let query = {};

        if(status === 'active'){
          query.isPublished = true;
        } else if(status === 'blocked'){
          query.isPublished = false;
        }

        if(search){
          const searchRegex = new RegExp(search,'i')

          query.$or = [
            {name: searchRegex}
          ]
        }

    const products = await Product.find(query)
      .populate("category")
      .populate("brand")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

      const totalProducts = await Product.countDocuments();
      const totalPages = Math.ceil(totalProducts / limit);

    res.render("admin/products", {
      products: products,
      currentSearch : search,
      currentStatus: status,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: "Error adding product" });
  }
};

const loadAddProduct = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    res.render("admin/add-product", { cat: category, brand: brand });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error loading product" });
  }
};

const BlockOrUnblock = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID format" });
        }
        const product = await Product.findById(id);
        if(!product){
            return res.status(400).json({success: false, message: "product not found"});
        }
        product.isPublished = !product.isPublished;
        await product.save();
        return res.status(200).json({success: true, message: 'product status changed'})
    } catch (err) {
        console.error(err);
        return res.status(500).json({success: false, message: 'Something went wrong'});
    }
};

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
      specKeys, // These come as arrays from the form
      specValues,
    } = req.body;

    // 1. Handle Images
    // Map over req.files to get just the filenames/paths
    // const images = req.files.map(file => file.filename);
    const images = req.files ? req.files.map((file) => file.secure_url) : [];

    // 2. Handle Specifications
    
    
    let specifications = [];
    if (specKeys && specValues) {
      // Ensure they are arrays (if only 1 spec is added, it might be a string)
      const keys = Array.isArray(specKeys) ? specKeys : [specKeys];
      const values = Array.isArray(specValues) ? specValues : [specValues];

      specifications = keys
        .map((key, index) => ({
          key: key,
          value: values[index],
        }))
        .filter((spec) => spec.key !== ""); // Filter out empty rows
    }

    if (processor) {
      specifications.push({ key: "Processor", value: processor });
    }
    const newProduct = new Product({
      name,
      description,
      brand: brand, // Maps to your Schema 'brandId'
      category: category, // Maps to your Schema 'categoryId'
      isPublished: isPublished === "on",
      images: images,
      specifications: specifications,
    });

    // 4. Save to Database
    const savedProduct = await newProduct.save();
    if (variantsData) {
        // Parse the string back into an Array
        const parsedVariants = JSON.parse(variantsData);

        // Loop through each variant and save it
        // We use Promise.all to save them all in parallel for speed
        await Promise.all(parsedVariants.map(async (variant) => {
            const newVariant = new Variant({
                productId: savedProduct._id,
                ram: variant.ram,
                storage: variant.storage,
                color: variant.color,
                price: variant.price,
                stock: variant.stock,
                graphics: variant.graphics,
                // You can generate a unique SKU here if you want:
                sku: `sku-${savedProduct._id}-${Math.floor(Math.random() * 1000)}` 
            });
  
    await newVariant.save();
        }));
    }
    // 5. Redirect back to products list
    return res
      .status(201)
      .json({ success: true, message: "Product and variants added successfully!" });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ success: false, message: "Error adding product" });
  }
};

const loadEditProduct = async (req,res) => {
  try{
    const id = req.params.id;

    const product = await Product.findById(id);
    if(!product){
      return res.status(404).json({success: false, message: 'Product not found or has been deleted'})
    }

    const variants = await Variant.find({productId: id});

    const categories = await Category.find({isListed: true});
    const brands = await Brand.find({isBlocked: false});

    res.render('admin/edit-product', {
      product: product,
      variants: variants,
      categories: categories,
      brands:brands
    })
  }catch (err){
    console.error("Erro while loading edit page", err)
    res.status(500).json({success: false, message: 'Something went wrong'})
  }
}

// Function to upload an image for a specific variant
const uploadVariantImage = async (req, res) => {
    try {
        const variantId = req.params.variantId;
        const file = req.file; // This comes from Multer

        if (!file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        // Find the variant and update just the 'image' field
        const updatedVariant = await Variant.findByIdAndUpdate(
            variantId, 
            { image: file.secure_url }, 
            { new: true } // Return the updated document
        );

        if (!updatedVariant) {
            return res.status(404).json({ success: false, message: "Variant not found" });
        }

        // Send back the new image filename so the frontend can show it immediately
        return res.status(200).json({ 
            success: true, 
            message: "Variant image updated successfully",
            image: file.secure_url
        });

    } catch (error) {
        console.error("Error uploading variant image:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const editProduct = async (req,res) => {
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
      deletedImages
    } = req.body;

    const product = await Product.findById(id);
    if(!product) {
      return res.status(404).json({success: false, message: 'Product not found'})
    }
    product.name = name;
    product.description = description;
    product.brand = brand;
    product.category = category;

    // --- B. HANDLE SPECIFICATIONS ---
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

        // --- C. HANDLE IMAGES ---
        
        // 1. Remove Deleted Images
        if (deletedImages) {
            const imagesToRemove = JSON.parse(deletedImages); // e.g., ["image1.jpg"]
            // Filter out images that match the ones in 'imagesToRemove'
            product.images = product.images.filter(img => !imagesToRemove.includes(img));
        }

        // 2. Add New Images (from Multer)
        if (req.files && req.files.length > 0) {
            // Append new filenames to the existing array
            const newImageFiles = req.files.map(file => file.secure_url);
            product.images.push(...newImageFiles);
        }

        await product.save();


        // --- D. HANDLE VARIANTS SYNC ---
        if (variantsData) {
            const parsedVariants = JSON.parse(variantsData);

            // 1. Identify IDs of variants sent from frontend
            // (If a variant has an _id, it's existing. If not, it's new)
            const sentVariantIds = parsedVariants
                .filter(v => v._id)
                .map(v => v._id);

            // 2. Delete variants that are in DB but NOT in the sent list
            // (This happens if user clicked "Remove" on the edit page)
            await Variant.deleteMany({
                productId: id,
                _id: { $nin: sentVariantIds }
            });

            // 3. Loop through sent variants to Update or Create
            for (const v of parsedVariants) {
                if (v._id) {
                    // UPDATE Existing Variant
                    await Variant.findByIdAndUpdate(v._id, {
                        ram: v.ram,
                        storage: v.storage,
                        color: v.color,
                        price: v.price,
                        stock: v.stock,
                        graphics: v.graphics
                    });
                } else {
                    // CREATE New Variant
                    const newVariant = new Variant({
                        productId: id,
                        ram: v.ram,
                        storage: v.storage,
                        color: v.color,
                        price: v.price,
                        stock: v.stock,
                        graphics: v.graphics,
                        sku: `sku-${Date.now()}-${Math.floor(Math.random() * 1000)}` // Generate SKU
                    });
                    await newVariant.save();
                }
            }
        }

        res.status(200).json({ success: true, message: "Product updated successfully!" });

    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ success: false, message: "Error updating product" });
    }
};
  

export default { loadProduct, addProduct, loadAddProduct, BlockOrUnblock, loadEditProduct, editProduct, uploadVariantImage };
