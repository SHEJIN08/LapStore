import Address from "../../model/addressModel.js";
import User from '../../model/userModel.js'
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      res.redirect("/user/login");
    }
    const addresses = await Address.find({ userId: userId}).sort({ isDefault: -1, _id: -1})


    res.render("user/manageAddress", {
      user: user,
      addresses: addresses
    });
  } catch (error) {
    console.error(error);
  }
};

const addAddress = async (req,res) => {
    try {
        const userId = req.session.user;

        if(!userId){
            return res.status(StatusCode.UNAUTHORIZED).json({success: false, message: ResponseMessage.UNAUTHORIZED})
        }

        const { addressType, name, phone, addressLine1, addressLine2, city, state, pincode } = req.body


        if(!addressType){
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please select a address type'})
        }
        if(addressType !== 'Home' && addressType !== 'Work' && addressType !== 'other'){
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please choose address from the given option'})
        }
        if(!name){
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please enter a name'})
        }
        if(phone.length < 10){
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please enter a valid number'})
        }
        if(!addressLine1) {
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please enter a address '})
        }
        if(!city) {
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please choose a city'})
        }
        if(!state){
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please choose a state'})
        }
        if(pincode.length !== 6){
              return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please enter a valid pincode'})
        }


        //Checking the user address count
        const addressCount = await Address.countDocuments({userId: userId});
        const isDefault = addressCount === 0;

        const newAddress = new Address({
        userId,
        addressType: addressType || "Home",
        fullName: name,
        phone,
        address1: addressLine1,
        address2: addressLine2,
        city,
        state,
        pincode,
        isDefault
        });

        await newAddress.save();

      return  res.status(StatusCode.OK).json({success: true, message: 'Address added successfully'})

    } catch (error) {
        console.error(error);
         res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const setDefaultAddress = async (req,res) => {
    try {
        const userId = req.session.user;
        const { addressId } = req.params;

        if(!userId){
            return res.status(StatusCode.UNAUTHORIZED).json({success: false, message: ResponseMessage.UNAUTHORIZED})
        }

  await Address.updateMany(
      { userId: userId },
      { $set: { isDefault: false } }
    );

    await Address.findByIdAndUpdate(
      addressId,
      { $set: { isDefault: true } }
    );

    res.status(StatusCode.OK).json({ success: true, message: "Default address updated" });
        
    } catch (error) {
        console.error(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const getAddressDetails = async (req, res) => {
  try {
    const { addressId } = req.params;
    const address = await Address.findById(addressId);
    
    if (!address) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, address });
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR});
  }
};

// 2. Update Address (Save changes)
 const editAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { 
      addressType, name, phone, 
      addressLine1, addressLine2, 
      city, state, pincode 
    } = req.body;

    // Validate inputs (Basic check)
    if (!name || !phone || !addressLine1 || !city || !state || !pincode) {
        return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "All required fields must be filled" });
    }

    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      {
        addressType,
        fullName: name,
        phone,
        address1: addressLine1,
        address2: addressLine2,
        city,
        state,
        pincode
      },
      { new: true } // Return the updated document
    );

    res.json({ success: true, message: "Address updated successfully" });

  } catch (error) {
    console.error(error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to update address" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    

    const deletedAddress = await Address.findByIdAndDelete(addressId);

    if (!deletedAddress) {
        return res.status(StatusCode.NOT_FOUND).json({ success: false, message: "Address not found" });
    }

    res.status(StatusCode.OK).json({ success: true, message: "Address deleted successfully" });

  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

export default {loadAddress, addAddress, setDefaultAddress, getAddressDetails, editAddress, deleteAddress};