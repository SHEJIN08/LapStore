import UserOtpVerification from "../../model/otpModel.js";
import userSchema from "../../model/userModel.js";

// ...existing code...
export const verifyOtp = async (req, res) => {
  try {
    const email = req.session.email;
    const { otp } = req.body;
    
    if (!email || !req.session.otpPurpose) {
  req.session.message = "Session expired. Please try again.";
  req.session.type = "error";
  return res.redirect("/user/login");
}


    const record = await UserOtpVerification.findOne({ email });

    if (!record) {
      req.session.message = "OTP expired. Request again.";
      req.session.type = "error";
      return res.redirect("/user/verify-otp");
    }

    if (record.otpCode !== otp) {
      req.session.message = "Invalid OTP!";
      req.session.type = "error";
      return res.redirect("/user/verify-otp");
    }

    // OTP is correct
    await UserOtpVerification.deleteMany({ email });

    // CASE 1 — Registration Verification
    if (req.session.otpPurpose === "register") {
      
      const user = await userSchema.findOneAndUpdate( 
        { email },
        { isVerified: true }
      );

      req.session.message = "Account verified!";
      req.session.type = "success";
      return res.redirect("/user/login");
    }

    // CASE 2 — Forgot Password
    if (req.session.otpPurpose === "password-reset") {
      req.session.allowReset = true;

      return res.redirect("/user/reset-password");
    }

  } catch (err) {
    console.error(err)
    req.session.message = "Something went wrong";
    req.session.type = "error";
    return res.redirect("/user/verify-otp");
  }
};

