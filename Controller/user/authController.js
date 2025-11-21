import Joi from "joi"; // 1. Import Joi
import bcrypt from "bcrypt";
import userSchema from "../../model/userModel.js";
import { sendOtp } from "../../utils/otp.js";
import UserOtpVerification from "../../model/otpModel.js";
const saltround = 10;

// 2. Define your Joi validation schema
const registerSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Name is required.",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please enter a valid email address.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 6 characters long.",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match.",
    "string.empty": "Please confirm your password.",
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Enter a valid email address.",
  }),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 6 characters long.",
  }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match.",
    "string.empty": "Please confirm your password.",
  }),
});

const registerUser = async (req, res) => {
  try {
    // 1. Joi validation
    const { error } = registerSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    if (error) {
      req.session.message = error.details[0].message;
      req.session.type = "error";
      return req.session.save(() => res.redirect("/user/register"));
    }

    // 2. Extract fields
    const { name, email, password } = req.body;

    // 3. Check user exists
    const existingUser = await userSchema.findOne({ email });

    if (existingUser) {
      req.session.message = "User already exists";
      req.session.type = "error";
      return req.session.save(() => res.redirect("/user/register"));
    }

    // 4. Save user (unverified)
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

    // 5. Send OTP
    await sendOtp(email);

    // 6. Set session for OTP verification
    req.session.email = email;
    req.session.otpPurpose = "register";
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000; //2 min

    // 7. Redirect (NOT render)
    return res.redirect("/user/verify-otp");

  } catch (err) {
    console.error(err);

    req.session.message = "Something went wrong!";
    req.session.type = "error";

    return res.redirect("/user/register");
  }
};


const loadVerifyOtp = (req, res) => {
   if (!req.session.email) {
    req.session.message = "Unauthorized access!";
    req.session.type = "error";
    return res.redirect("/user/register");
  }
  const message = req.session.message || "";
  const type = req.session.type || "";
  const otpExpiresAt = req.session.otpExpiresAt;

  req.session.message = null;
  req.session.type = null;

  return res.render("user/verifyOtp", {
    message,
    type,
    otpExpiresAt,
  });
};


const resendOtp = async (req, res) => {
  try {
    const email = req.session.email;

      if (!email) {
      req.session.message = "Session expired — please try again.";
      req.session.type = "error";
      return res.redirect("/user/register");
    }

    await UserOtpVerification.deleteMany({ email });

    await sendOtp(email);

    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000; // reset timer

    req.session.message = "OTP resent successfully!";
    req.session.type = "success";

    return res.redirect("/user/verify-otp");
  } catch (err) {
    console.error(err);
    req.session.message = "Failed to resend OTP";
    req.session.type = "error";
    return res.redirect("/user/verify-otp");
  }
};

const forgotPasswordPost = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("BODY:", req.body);

    // Validate input
    const { error } = forgotPasswordSchema.validate({ email });
    if (error) {
      req.session.message = error.details[0].message;
      req.session.type = "error";
      return res.redirect("/user/forgot-password");
    }

    const user = await userSchema.findOne({ email });

    if (!user) {
      req.session.message = "No account found with this email!";
      req.session.type = "error";
      return res.redirect("/user/forgot-password");
    }

    // Save email & type of OTP process
    req.session.email = email;
    req.session.otpPurpose = "password-reset"; // 👈 Important

    // Send OTP
    await sendOtp(email);

    return res.redirect("/user/verify-otp"); // 👈 SAME OTP PAGE USED IN REGISTER
  } catch (err) {
    console.error(err);
    req.session.message = "Something went wrong";
    req.session.type = "error";
    return res.redirect("/user/forgot-password");
  }
};

const resetPasswordPost = async (req, res) => {
  try {
    if (!req.session.allowReset || !req.session.email) {
      req.session.message = "Unauthorized access!";
      req.session.type = "error";
      return res.redirect("/user/login");
    }

    const { error } = resetPasswordSchema.validate(req.body);

    if (error) {
      req.session.message = error.details[0].message;
      req.session.type = "error";
      return res.redirect("/user/reset-password");
    }

    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await userSchema.updateOne(
      { email: req.session.email },
      { password: hashedPassword }
    );

    // Clear session flags
    req.session.allowReset = false;
    req.session.email = null;

    req.session.message = "Password reset successfully!";
    req.session.type = "success";

    return res.redirect("/user/login");
  } catch (err) {
    console.log(err);
    req.session.message = "Something went wrong!";
    req.session.type = "error";
    return res.redirect("/user/reset-password");
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userSchema.findOne({ email });
    if (!user) {
      req.session.message = "User not found";
      req.session.type = "error";
      return res.redirect("/user/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.session.message = "Incorrect password";
      req.session.type = "error";
      return res.redirect("/user/login");
    }
    req.session.message = "User Login Successfully";
    req.session.type = "success";
    return res.redirect("/user/home");
  } catch (err) {
    console.error(err);
    req.session.message = "An error occurred";
    req.session.type = "error";
    return res.redirect("/user/login");
  }
};

const loadRegister = (req, res) => {
  const message = req.session.message || "";
  const type = req.session.type || "";

  // Clear the message from session
  req.session.message = null;
  req.session.type = null;

  res.render("user/register", { message, type });
};

const loadResetPassword = (req, res) => {
  if (!req.session.allowReset) {
    req.session.message = "Unauthorized request!";
    req.session.type = "error";
    return res.redirect("/user/login");
  }

  const message = req.session.message || "";
  const type = req.session.type || "";

  req.session.message = null;
  req.session.type = null;

  res.render("user/resetPassword", { message, type });
};

const forgotPassword = (req, res) => {
  res.render("user/forgotPassword");
};
const loadLogin = (req, res) => {
  const message = req.session.message || "";
  const type = req.session.type || "";

  // Clear the message from session so it only shows once
  req.session.message = null;
  req.session.type = null;

  res.render("user/login", { message, type });
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
