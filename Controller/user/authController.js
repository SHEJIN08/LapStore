import Joi from "joi"; 
import bcrypt from "bcrypt";
import userSchema from "../../model/userModel.js";
import { sendOtp } from "../../utils/otp.js";
import UserOtpVerification from "../../model/otpModel.js";
const saltround = 10;

// ... (Your Joi Schemas remain the same) ...
const registerSchema = Joi.object({
  name: Joi.string().required().messages({ "string.empty": "Name is required." }),
  email: Joi.string().email().required().messages({ "string.empty": "Email is required.", "string.email": "Please enter a valid email address." }),
  password: Joi.string().min(6).required().messages({ "string.empty": "Password is required.", "string.min": "Password must be at least 6 characters long." }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({ "any.only": "Passwords do not match.", "string.empty": "Please confirm your password." }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({ "string.empty": "Email is required.", "string.email": "Enter a valid email address." }),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).required().messages({ "string.empty": "Password is required.", "string.min": "Password must be at least 6 characters long." }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({ "any.only": "Passwords do not match.", "string.empty": "Please confirm your password." }),
});

// ==========================================
// 🚀 REGISTER USER
// ==========================================
const registerUser = async (req, res) => {
  try {
    // 1. Joi validation
    const { error } = registerSchema.validate(req.body, { abortEarly: false, allowUnknown: true });
    if (error) {
      return res.status(400).json({success: false, message: error.details[0].message});
    }

    const { name, email, password } = req.body;

    // 2. Check user exists
    const existingUser = await userSchema.findOne({ email });
    if (existingUser) {
      return res.status(400).json({success: false, message: 'User already exists'});
    }

    // 3. Save user (unverified)
    const hashedPassword = await bcrypt.hash(password, saltround);
    const userId = `user_${Date.now()}`;

    const newUser = new userSchema({
      userId,
      name,
      email,
      password: hashedPassword,
      isVerified: false,
    });

    await newUser.save();

    // 4. Send OTP
    await sendOtp(email);

    // 5. Set session
    req.session.email = email;
    req.session.otpPurpose = "register";
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000; 

    // ✅ FIXED: Return JSON success (Frontend handles redirect)
    return res.status(200).json({success: true, message: "Registration successful"});

  } catch (err) {
    console.error(err);
    return res.status(500).json({success: false, message: 'Something went wrong'});
  }
};

// ==========================================
// 🚀 LOAD VERIFY OTP PAGE
// ==========================================
const loadVerifyOtp = (req, res) => {
   if (!req.session.email) {
     return res.redirect('/user/register'); // Redirect if no session
  }

  const otpExpiresAt = req.session.otpExpiresAt;

  // ✅ FIXED: Removed undefined 'message' and 'type' variables
  return res.render("user/verifyOtp", {
    otpExpiresAt,
  });
};

// ==========================================
// 🚀 RESEND OTP
// ==========================================
const resendOtp = async (req, res) => {
  try {
    const email = req.session.email;

    if (!email) {
      return res.status(400).json({success: false, message: 'Session expired — please try again.'});
    }

    await UserOtpVerification.deleteMany({ email });
    await sendOtp(email);
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000; 

    // ✅ FIXED: Only JSON, no redirect
    return res.status(200).json({success: true, message: 'OTP resent successfully.'});

  } catch (err) {
    console.error(err);
    return res.status(500).json({success: false, message: 'Failed to resend otp.'});
  }
};

// ==========================================
// 🚀 FORGOT PASSWORD (POST)
// ==========================================
const forgotPasswordPost = async (req, res) => {
  try {
    const { email } = req.body;

    const { error } = forgotPasswordSchema.validate({ email });
    if (error) {
       return res.status(400).json({success: false, message: error.details[0].message });
    }

    const user = await userSchema.findOne({ email });
    if (!user) {
       return res.status(400).json({success: false, message: 'No account found with this email'});
    }

    req.session.email = email;
    req.session.otpPurpose = "password-reset"; 

    await sendOtp(email);

    // ✅ FIXED: Return JSON
    return res.status(200).json({success: true, message: "OTP sent to email"});
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({success: false, message: 'Something went wrong'});
  }
};

// ==========================================
// 🚀 RESET PASSWORD (POST)
// ==========================================
const resetPasswordPost = async (req, res) => {
  try {
    if (!req.session.allowReset || !req.session.email) {
       return res.status(401).json({success: false, message: 'Unauthorized access'});
    }

    const { error } = resetPasswordSchema.validate(req.body);
    if (error) {
       // ✅ FIXED: Typo error.details.message[0] -> error.details[0].message
       return res.status(400).json({success: false, message: error.details[0].message});
    }

    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await userSchema.updateOne(
      { email: req.session.email },
      { password: hashedPassword }
    );

    req.session.allowReset = false;
    req.session.email = null;

    // ✅ FIXED: Removed unreachable redirect
    return res.status(200).json({success: true, message: 'Password reset successful'});

  } catch (err) {
    console.log(err);
    return res.status(500).json({success: false, message: 'Something went wrong'});
  }
};

// ==========================================
// 🚀 LOGIN
// ==========================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userSchema.findOne({ email });
    
    // ✅ FIXED: Added 'return' to stop execution if user not found
    if (!user) {
       return res.status(400).json({success: false, message: 'User not found'});
    }
    
    // Optional: Check if user is verified
    // if (!user.isVerified) {
    //    return res.status(401).json({success: false, message: 'Please verify your email first'});
    // }

    const isMatch = await bcrypt.compare(password, user.password);
    
    // ✅ FIXED: Added 'return'
    if (!isMatch) {
       return res.status(400).json({success: false, message: 'Incorrect password'});
    }

    // ✅ FIXED: Actually create the session!
    req.session.user = user._id; 

    return res.status(200).json({success: true, message: 'Login successful'});

  } catch (err) {
    console.error(err);
    return res.status(500).json({success: false, message: 'Something went wrong'});
  }
};

// ==========================================
// 🚀 RENDER PAGES (GET)
// ==========================================
const loadRegister = (req, res) => {
  res.render("user/register");
};

const loadResetPassword = (req, res) => {
  if (!req.session.allowReset) {
     return res.redirect("/user/login"); // Redirect for GET request if unauthorized
  }
  res.render("user/resetPassword");
};

const forgotPassword = (req, res) => {
  res.render("user/forgotPassword");
};

const loadLogin = (req, res) => {
  res.render("user/login");
};

export default {
  registerUser,
  loadRegister,
  loadLogin,
  resendOtp,
  forgotPassword,
  forgotPasswordPost,
  loadResetPassword,
  resetPasswordPost,
  login,
  loadVerifyOtp
};