import referralService from "../../services/admin/referralService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const getReferrals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const search = req.query.search || "";
    const status = req.query.status || "";

    const data = await referralService.listReferrals({
      page,
      limit,
      search,
      status,
    });

    res.render("admin/referral", {
      referrals: data.referrals,
      currentPage: page,
      totalPages: data.totalPages,
      totalReferrals: data.totalReferrals,
      limit: limit,
      search: search,
      status: status,
    });
  } catch (error) {
    console.error(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

export default { getReferrals };
