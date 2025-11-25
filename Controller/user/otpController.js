import UserOtpVerification from "../../model/otpModel.js";
import userSchema from "../../model/userModel.js";

export const verifyOtp = async (req, res) => {
  try {
    const email = req.session.email;
    const { otp } = req.body;

    // 1. Check if session exists
    if (!email || !req.session.otpPurpose) {
      return res.status(400).json({ 
        success: false, 
        message: "Session expired. Please try to login or register again." 
      });
    }

    // 2. Find OTP record in DB
    const record = await UserOtpVerification.findOne({ email });

    if (!record) {
      return res.status(400).json({ 
        success: false, 
        message: "OTP expired or invalid. Please request a new one." 
      });
    }

    // 3. Verify OTP Match
    if (record.otpCode !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OTP! Please check and try again." 
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

      return res.status(200).json({ 
        success: true, 
        message: "Email verified successfully!", 
        redirectUrl: "/user/login" // Frontend will use this
      });
    }

    // CASE B: Forgot Password Verification
    if (req.session.otpPurpose === "password-reset") {
      
      // Mark session as allowed to reset password
      req.session.allowReset = true;
      req.session.otpPurpose = null;

      return res.status(200).json({ 
        success: true, 
        message: "OTP Verified! Redirecting...", 
        redirectUrl: "/user/reset-password" 
      });
    }

  } catch (err) {
    console.error("OTP Error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Something went wrong during verification." 
    });
  }
};