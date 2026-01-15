import wishlistService from "../../services/user/wishlistService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";
const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const { items, totalPages, currentPage } =
      await wishlistService.getWishlist(userId, page, limit);

    res.render("user/wishlist", {
      items,
      currentPage,
      totalPages,
      user: userId,
    });
  } catch (error) {
    console.error(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, variantId } = req.body;

    if (!userId) {
      return res
        .status(StatusCode.UNAUTHORIZED)
        .json({ success: false, message: "Please login to add items" });
    }

    await wishlistService.addToWishlist(userId, productId, variantId);

    res
      .status(StatusCode.OK)
      .json({ success: true, message: "Item added to wishlist" });
  } catch (error) {
    console.log(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId } = req.params;

    await wishlistService.removeFromWishlist(userId, itemId);

    res
      .status(StatusCode.OK)
      .json({ success: true, message: "Item removed from the wishlist" });
  } catch (error) {
    console.log(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

export default { loadWishlist, addToWishlist, removeFromWishlist };
