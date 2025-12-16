import otpService from "../../services/user/otpService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const verifyOtp = async (req, res) => {
  try {
    const email = req.session.email;
    const { otp } = req.body;
    const purpose = req.session.otpPurpose;

    // 1. Check Session
    if (!email || !purpose) {
      return res.status(StatusCode.BAD_REQUEST).json({ 
        success: false, 
        message: ResponseMessage.OTP_EXP 
      });
    }

    // 2. Verify OTP via Service (Throws error if invalid)
    await otpService.verifyAndClearOtp(email, otp);

    // -----------------------------------------
    // ✅ HANDLE PURPOSES (Session Logic)
    // -----------------------------------------

    // CASE A: Registration
    if (purpose === "register") {
      const userData = await otpService.markUserVerified(email);

      // Session Updates
      req.session.otpPurpose = null; 
      req.session.email = null;
      req.session.user = userData._id;

      return res.status(StatusCode.OK).json({ 
        success: true, 
        message: ResponseMessage.EMAIL_VER, 
        redirectUrl: "/user/home" 
      });
    }

    // CASE B: Forgot Password
    if (purpose === "password-reset") {
      req.session.allowReset = true;
      req.session.otpPurpose = null;

      return res.status(StatusCode.OK).json({ 
        success: true, 
        message: ResponseMessage.OTP_VER, 
        redirectUrl: "/user/reset-password" 
      });
    }

    // CASE C: Profile Update
    if (purpose === "profile-update") {
      const { newName, newEmail } = req.session.tempUpdateData;
      
      // Ensure we get the raw ID string
      const userId = req.session.user._id || req.session.user;

      const updatedUser = await otpService.updateUserProfile(userId, newName, newEmail);

      // Session Updates
      req.session.user = updatedUser._id;
      req.session.otpPurpose = null;
      delete req.session.tempUpdateData;

      return res.status(StatusCode.OK).json({
        success: true,
        message: "Profile updated successfully",
      });
    }

  } catch (err) {
    // Handle Known Logic Errors (Invalid OTP / Expired)
    if (err.message === ResponseMessage.OTP_EXP || err.message === ResponseMessage.INV_OTP) {
        return res.status(StatusCode.BAD_REQUEST).json({ 
            success: false, 
            message: err.message 
        });
    }

    console.error("OTP Error:", err);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: ResponseMessage.SERVER_ERROR
    });
  }
};

export default { verifyOtp };