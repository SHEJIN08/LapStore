import UserOtpVerification from "../../model/otpModel.js";
import userSchema from "../../model/userModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

const verifyAndClearOtp = async (email, inputOtp) => {
  // 1. Find Record
  const record = await UserOtpVerification.findOne({ email });

  if (!record) {
    throw new Error(ResponseMessage.OTP_EXP);
  }

  // 2. Check Match
  if (record.otpCode !== inputOtp) {
    throw new Error(ResponseMessage.INV_OTP);
  }

  // 3. Clear Record (Success)
  await UserOtpVerification.deleteMany({ email });
  return true;
};

// --- MARK USER AS VERIFIED (For Registration) ---
const markUserVerified = async (email) => {
  const userData = await userSchema.findOneAndUpdate(
    { email },
    { isVerified: true },
    { new: true }
  );
  return userData;
};

// --- UPDATE USER PROFILE (For Profile Update) ---
const updateUserProfile = async (userId, newName, newEmail) => {
  const updatedUser = await userSchema.findByIdAndUpdate(
    userId,
    {
      name: newName,
      email: newEmail,
    },
    { new: true }
  );
  return updatedUser;
};

export default {
  verifyAndClearOtp,
  markUserVerified,
  updateUserProfile,
};
