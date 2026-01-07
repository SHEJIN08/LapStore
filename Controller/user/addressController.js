import addressService from "../../services/user/addressService.js";
import User from "../../model/userModel.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";


const loadAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) return res.redirect("/user/login");

    const addresses = await addressService.getUserAddressesService(userId);

    res.render("user/manageAddress", {
      user: user,
      addresses: addresses,
    });
  } catch (error) {
    console.error(error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId)
      return res
        .status(StatusCode.UNAUTHORIZED)
        .json({ success: false, message: ResponseMessage.UNAUTHORIZED });

    const {
      addressType,
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
    } = req.body;

    if (!addressType)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Please select a address type" });
    if (!["Home", "Work", "Other"].includes(addressType))
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({
          success: false,
          message: "Please choose address from the given option",
        });
    if (!name)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Please enter a name" });
    if (phone.length < 10)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Please enter a valid number" });
    if (!addressLine1)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Please enter a address" });
    if (!city)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Please choose a city" });
    if (!state)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Please choose a state" });
    if (pincode.length !== 6)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Please enter a valid pincode" });

    await addressService.addAddressService(userId, {
      addressType,
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
    });

    res
      .status(StatusCode.OK)
      .json({ success: true, message: "Address added successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// --- SET DEFAULT ---
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.params;
    if (!userId)
      return res
        .status(StatusCode.UNAUTHORIZED)
        .json({ success: false, message: ResponseMessage.UNAUTHORIZED });

    await addressService.setDefaultAddressService(userId, addressId);

    res
      .status(StatusCode.OK)
      .json({ success: true, message: "Default address updated" });
  } catch (error) {
    console.error(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};


const getAddressDetails = async (req, res) => {
  try {
    const { addressId } = req.params;

    const address = await addressService.getAddressByIdService(addressId);

    res.json({ success: true, address });
  } catch (error) {
    if (error.message === "Address not found") {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: "Address not found" });
    }
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};


const editAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const {
      addressType,
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
    } = req.body;

    if (!name || !phone || !addressLine1 || !city || !state || !pincode) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({
          success: false,
          message: "All required fields must be filled",
        });
    }

    await addressService.updateAddressService(addressId, {
      addressType,
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
    });

    res.json({ success: true, message: "Address updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to update address" });
  }
};


const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    await addressService.deleteAddressService(addressId);

    res
      .status(StatusCode.OK)
      .json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    if (error.message === "Address not found") {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: "Address not found" });
    }
    console.error("Error deleting address:", error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

export default {
  loadAddress,
  addAddress,
  setDefaultAddress,
  getAddressDetails,
  editAddress,
  deleteAddress,
};
