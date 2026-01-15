import Wishlist from "../../model/wishlistModel.js";

const getWishlist = async (userId, page = 1, limit = 4) => {
  try {
    const skip = (page - 1) * limit;

    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "name brand isPublished",
        populate: {
          path: "brand",
          select: "brandName",
        },
      })
      .populate({
        path: "items.variantId",
        select: "salePrice regularPrice image stock",
      });

    if (!wishlist) {
      return { items: [], totalPages: 0, currentPage: 1 };
    }

    let validItems = wishlist.items
      .filter((item) => item.productId && item.variantId)
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

    const totalItems = validItems.length;
    const totalPages = Math.ceil(totalItems / limit);

    // Manual pagination (since items is an array inside one document)
    const paginatedItems = validItems.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      totalPages,
      currentPage: page,
      totalItems,
    };
  } catch (error) {
    throw new Error("Error fetching wishlist");
  }
};

const addToWishlist = async (userId, productId, variantId) => {
  try {
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] });
    }

    const exists = wishlist.items.some(
      (item) => item.variantId.toString() === variantId
    );

    if (exists) {
      throw new Error("Item already exists in wishlist");
    }

    wishlist.items.push({ productId, variantId });
    await wishlist.save();

    return wishlist;
  } catch (error) {
    throw new Error(error.message);
  }
};

const removeFromWishlist = async (userId, itemId) => {
  try {
    await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { items: { _id: itemId } } }
    );
  } catch (error) {
    throw new Error("Error removing item from wishlist");
  }
};

export default { getWishlist, addToWishlist, removeFromWishlist };
