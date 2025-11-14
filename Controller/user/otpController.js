import UserOtpVerification from "../../model/otpModel.js";
import userSchema from "../../model/userMode.js";

// ...existing code...
export const verifyOtp = async (req, res) => {
  try {
    const email = req.session.email;
    // accept either field name sent by the form or other places
  const { otp } = req.body;

    if (!email) {
      req.session.message = "Session expired. Please register again.";
      req.session.type = "error";
      return res.redirect("/user/register");
    }

    const otpRecord = await UserOtpVerification.findOne({ email });



    if (!otpRecord) {
      req.session.message = "OTP expired. Please resend.";
      req.session.type = "error";
      return res.redirect("/user/verify-otp");
    }

     if (otpRecord.otpCode !== otp) {
      req.session.message = "Invalid OTP!";
      req.session.type = "error";
      return res.redirect("/user/verify-otp");
    }
     await userSchema.updateOne({ email }, { isVerified: true });

    // delete otp after verification
    await UserOtpVerification.deleteMany({ email });

    req.session.message = "Account verified successfully!";
    req.session.type = "success";
    return res.redirect("/user/login");

  } catch (error) {
    console.log(error);
    req.session.message = "Something went wrong!";
    req.session.type = "error";
    return res.redirect("/user/verify-otp");
  }
};
// ...existing code...