import mongoose from "mongoose";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import Category from "../../model/categoryModel.js";
import Brand from "../../model/brandModel.js";

const loadProduct = async (req, res) => {
  try {
    const products = await Product.find({})
      .populate("category")
      .populate("brand")
      .sort({ createdAt: -1 });

    res.render("admin/products", {
      products: products,
      currentPage: 1,
      totalPages: 1, // Adding this to prevent pagination errors
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

export default { loadProduct, addProduct, loadAddProduct, BlockOrUnblock };
