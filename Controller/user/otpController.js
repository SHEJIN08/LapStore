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
      await userSchema.findOneAndUpdate( 
        { email },
        { isVerified: true }
      );

      // Clear specific session flags
      req.session.otpPurpose = null; 
      req.session.email = null;
      req.session.user = true;

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

  } catch (err) {
    console.error("OTP Error:", err);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: ResponseMessage.SERVER_ERROR
    });
  }
};