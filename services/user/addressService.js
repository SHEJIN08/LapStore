import Address from "../../model/addressModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET ALL ADDRESSES FOR USER ---
const getUserAddressesService = async (userId) => {
    return await Address.find({ userId: userId }).sort({ isDefault: -1, _id: -1 });
};

// --- ADD NEW ADDRESS ---
const addAddressService = async (userId, addressData) => {
    // 1. Check if this is the first address (to make it default)
    const addressCount = await Address.countDocuments({ userId: userId });
    const isDefault = addressCount === 0;

    // 2. Create the address object
    const newAddress = new Address({
        userId,
        addressType: addressData.addressType || "Home",
        fullName: addressData.name,
        phone: addressData.phone,
        address1: addressData.addressLine1,
        address2: addressData.addressLine2,
        city: addressData.city,
        state: addressData.state,
        pincode: addressData.pincode,
        isDefault
    });

    // 3. Save
    await newAddress.save();
    return newAddress;
};

// --- SET DEFAULT ADDRESS ---
const setDefaultAddressService = async (userId, addressId) => {
   
    await Address.updateMany(
        { userId: userId },
        { $set: { isDefault: false } }
    );

    // 2. Set new default
    const updatedAddress = await Address.findByIdAndUpdate(
        addressId,
        { $set: { isDefault: true } },
        { new: true }
    );
    
    return updatedAddress;
};

// --- GET SINGLE ADDRESS DETAILS ---
const getAddressByIdService = async (addressId) => {
    const address = await Address.findById(addressId);
    if (!address) throw new Error("Address not found");
    return address;
};

// --- UPDATE ADDRESS ---
const updateAddressService = async (addressId, updateData) => {
    const updatedAddress = await Address.findByIdAndUpdate(
        addressId,
        {
            addressType: updateData.addressType,
            fullName: updateData.name,
            phone: updateData.phone,
            address1: updateData.addressLine1,
            address2: updateData.addressLine2,
            city: updateData.city,
            state: updateData.state,
            pincode: updateData.pincode
        },
        { new: true }
    );

    if (!updatedAddress) throw new Error("Address not found");
    return updatedAddress;
};

// --- DELETE ADDRESS ---
const deleteAddressService = async (addressId) => {
    const deletedAddress = await Address.findByIdAndDelete(addressId);
    if (!deletedAddress) throw new Error("Address not found");
    return deletedAddress;
};

export default {
    getUserAddressesService,
    addAddressService,
    setDefaultAddressService,
    getAddressByIdService,
    updateAddressService,
    deleteAddressService
};