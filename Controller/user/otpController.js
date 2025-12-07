import UserOtpVerification from "../../model/otpModel.js";
import userSchema from "../../model/userModel.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

export const verifyOtp = async (req, res) => {
  try {
    const email = req.session.email;
    const { otp } = req.body;

    // 1. Check if session exists
    if (!email || !req.session.otpPurpose) {
      return res.status(StatusCode.BAD_REQUEST).json({ 
        success: false, 
        message: ResponseMessage.OTP_EXP 
      });
    }

    // 2. Find OTP record in DB
    const record = await UserOtpVerification.findOne({ email });

    if (!record) {
      return res.status(StatusCode.BAD_REQUEST).json({ 
        success: false, 
        message: ResponseMessage.OTP_EXP
      });
    }

    // 3. Verify OTP Match
    if (record.otpCode !== otp) {
      return res.status(StatusCode.BAD_REQUEST).json({ 
        success: false, 
        message: ResponseMessage.INV_OTP
      });
    }

    // -----------------------------------------
    // ✅ SUCCESS: OTP IS VALID
    // -----------------------------------------
    
    // Clean up OTP from DB (prevent reuse)
    await UserOtpVerification.deleteMany({ email });

    // CASE A: Registration Verification
    if (req.session.otpPurpose === "register") {
      
      // Update user to verified status
      const userData = await userSchema.findOneAndUpdate( 
        { email },
        { isVerified: true },
        {new: true}
      );

      // Clear specific session flags
      req.session.otpPurpose = null; 
      req.session.email = null;
      req.session.user = userData._id;

      return res.status(StatusCode.OK).json({ 
        success: true, 
        message: ResponseMessage.EMAIL_VER, 
        redirectUrl: "/user/home" // Frontend will use this
      });
    }

    // CASE B: Forgot Password Verification
    if (req.session.otpPurpose === "password-reset") {
      
      // Mark session as allowed to reset password
      req.session.allowReset = true;
      req.session.otpPurpose = null;

      return res.status(StatusCode.OK).json({ 
        success: true, 
        message: ResponseMessage.OTP_VER, 
        redirectUrl: "/user/reset-password" 
      });
    }

    // CASE C: Profile Update Verification (NEW ADDITION)
    if (req.session.otpPurpose === "profile-update") {

        // 1. Retrieve the temp data we stored in the previous step
        const { newName, newEmail } = req.session.tempUpdateData;
        
        const userId = req.session.user._id || req.session.user;
        // 2. Update the actual User Database
        // We use the ID from the logged-in session to be safe
        const updatedUser = await userSchema.findByIdAndUpdate(
            userId, 
            { 
                name: newName, 
                email: newEmail 
            },
            { new: true }
        );

        // 3. Update the ACTIVE session so the UI updates immediately
        req.session.user = updatedUser._id;

        // 4. Cleanup session flags
        req.session.otpPurpose = null;
        delete req.session.tempUpdateData; // Remove the temp data
        
        // Note: We don't nullify req.session.email here because the user is still logged in

        return res.status(StatusCode.OK).json({
            success: true,
            message: "Profile updated successfully",
            // No redirect URL needed if you just want to reload the page or show a toast
        });
    }

  } catch (err) {
    console.error("OTP Error:", err);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: ResponseMessage.SERVER_ERROR
    });
  }
};