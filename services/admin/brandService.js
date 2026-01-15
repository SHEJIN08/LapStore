import Brand from "../../model/brandModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET ALL BRANDS (Paginated & Search) ---
const getAllBrandsService = async ({ search, status, page, limit }) => {
  const skip = (page - 1) * limit;
  let query = {};

  // Status Filter
  if (status === "active") {
    query.isBlocked = false;
  } else if (status === "blocked") {
    query.isBlocked = true;
  }

  // Search Filter
  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [{ brandName: searchRegex }];
  }

  // Fetch Data
  const brands = await Brand.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Count Totals
  const totalBrands = await Brand.countDocuments(query); // Count based on query, not all docs
  const totalPages = Math.ceil(totalBrands / limit);

  return { brands, totalBrands, totalPages };
};

// --- CREATE BRAND ---
const createBrandService = async ({
  brandName,
  country,
  foundedYear,
  website,
  description,
  imageUrl,
}) => {
  // Check duplicate (Case Insensitive)
  const findBrand = await Brand.findOne({
    brandName: { $regex: new RegExp("^" + brandName + "$", "i") },
  });

  if (findBrand) {
    throw new Error(ResponseMessage.DUP_BRAND);
  }

  const newBrand = new Brand({
    brandName,
    brandImage: [imageUrl],
    country,
    foundedYear,
    website,
    description,
  });

  await newBrand.save();
  return newBrand;
};

// --- GET SINGLE BRAND ---
const getBrandByIdService = async (brandId) => {
  const brand = await Brand.findById(brandId);
  if (!brand) throw new Error(ResponseMessage.BRAND_NOT_FOUND);
  return brand;
};

// --- TOGGLE STATUS (Block/Unblock) ---
const toggleBrandStatusService = async (brandId) => {
  const brand = await Brand.findById(brandId);
  if (!brand) throw new Error(ResponseMessage.BRAND_NOT_FOUND);

  brand.isBlocked = !brand.isBlocked;
  await brand.save();
  return brand;
};

// --- UPDATE BRAND ---
const updateBrandService = async (brandId, data, newImageUrl) => {
  const brand = await Brand.findById(brandId);
  if (!brand) throw new Error(ResponseMessage.BRAND_NOT_FOUND);

  // Update Text Fields
  brand.brandName = data.brandName;
  brand.country = data.country;
  brand.foundedYear = data.foundedYear;
  brand.website = data.website;
  brand.description = data.description;

  // Update Image only if new one provided
  if (newImageUrl) {
    brand.brandImage = [newImageUrl];
  }

  await brand.save();
  return brand;
};

export default {
  getAllBrandsService,
  createBrandService,
  getBrandByIdService,
  toggleBrandStatusService,
  updateBrandService,
};
