import Category from "../../model/categoryModel.js";
import Product from "../../model/productModel.js";
import Variant from "../../model/variantModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET ALL CATEGORIES (Paginated & Filtered) ---
const getAllCategoriesService = async ({ search, filter, page, limit }) => {
  const skip = (page - 1) * limit;
  let query = {};

  // Filter Logic
  if (filter === "active") {
    query.isListed = true;
  } else if (filter === "blocked") {
    query.isListed = false;
  }

  // Search Logic
  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [{ categoryName: searchRegex }];
  }

  // Fetch Data
  const categories = await Category.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Count Totals
  const totalCategories = await Category.countDocuments(query); // Fixed: count based on query
  const totalPages = Math.ceil(totalCategories / limit);

  return { categories, totalCategories, totalPages };
};

// --- CREATE CATEGORY ---
const createCategoryService = async ({
  categoryName,
  description,
  isListed,
  count,
}) => {
  // Check Duplicate
  const existingCategory = await Category.findOne({
    categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
  });

  if (existingCategory) {
    throw new Error(ResponseMessage.DUP_CATEGORY);
  }

  const newCategory = new Category({
    categoryName,
    description,
    count: Number(count) || 0,
    isListed: isListed === "true" || isListed === true,
  });

  await newCategory.save();
  return newCategory;
};

// --- GET CATEGORY DETAILS + PRODUCT STATS ---
const getCategoryWithProductsService = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error("Category not found");

  // Fetch Products
  const productDocs = await Product.find({ category: categoryId }).sort({
    createdAt: -1,
  });

  // Calculate Price/Stock from Variants
  const products = await Promise.all(
    productDocs.map(async (product) => {
      const variants = await Variant.find({ productId: product._id });

      // Calculate "Starts At" Price
      const prices = variants
        .map((v) => v.salePrice)
        .filter((p) => p !== undefined);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

      // Calculate Total Stock
      const totalStock = variants.reduce(
        (acc, curr) => acc + (curr.stock || 0),
        0
      );

      return {
        _id: product._id,
        name: product.name,
        isPublished: product.isPublished,
        price: minPrice,
        stock: totalStock,
      };
    })
  );

  return { category, products };
};

// --- UPDATE CATEGORY ---
const updateCategoryService = async (
  id,
  { categoryName, description, isListed }
) => {
  const category = await Category.findById(id);
  if (!category) throw new Error("Category not found");

  // Check Duplicate (Excluding current ID)
  const existingCategory = await Category.findOne({
    categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
    _id: { $ne: id },
  });

  if (!categoryName) {
    throw new Error("categoryName is required");
  }

  if (existingCategory) {
    throw new Error(ResponseMessage.DUP_CATEGORY);
  }

  category.categoryName = categoryName;
  category.description = description;
  category.isListed = isListed === "true" || isListed === true;

  await category.save();
  return category;
};

// --- TOGGLE STATUS ---
const toggleCategoryStatusService = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw new Error("Category not found");

  category.isListed = !category.isListed;
  await category.save();

  return category;
};

export default {
  getAllCategoriesService,
  createCategoryService,
  getCategoryWithProductsService,
  updateCategoryService,
  toggleCategoryStatusService,
};
