import Joi from "joi";
import authService from "../../services/user/authService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const registerSchema = Joi.object({
  name: Joi.string()
    .required()
    .messages({ "string.empty": "Name is required." }),
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
  referralCode: Joi.string().allow("").optional(),
});

const registerUser = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });
    if (error)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: error.details[0].message });

    const { name, email, password, referralCode } = req.body;

    await authService.registerUserService({
      name,
      email,
      password,
      referralCodeInput: referralCode,
    });

    //  Set Session
    req.session.email = email;
    req.session.otpPurpose = "register";
    req.session.otpExpiresAt = Date.now() + 1 * 60 * 1000;

    return res
      .status(StatusCode.OK)
      .json({ success: true, message: ResponseMessage.REG_SUCCESS });
  } catch (err) {
    // Handle Service Errors (like Duplicate User)
    if (err.message === ResponseMessage.DUP_USER) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: err.message });
    }
    console.error(err);
    return res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await authService.loginUserService({ email, password });

    req.session.user = user._id;

    return res
      .status(StatusCode.OK)
      .json({ success: true, message: ResponseMessage.LOGIN_SUCCESS });
  } catch (err) {
    const expectedErrors = [
      ResponseMessage.USER_NOT_FOUND,
      ResponseMessage.VER_EMAIL,
      ResponseMessage.USER_BLOCK,
      ResponseMessage.WRONG_PASS,
    ];

    if (expectedErrors.includes(err.message)) {
      const status =
        err.message === ResponseMessage.VER_EMAIL ||
        err.message === ResponseMessage.USER_BLOCK
          ? StatusCode.UNAUTHORIZED
          : StatusCode.BAD_REQUEST;
      return res.status(status).json({ success: false, message: err.message });
    }

    console.error(err);
    return res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const forgotPasswordPost = async (req, res) => {
  try {
    const { email } = req.body;
    const { error } = forgotPasswordSchema.validate({ email });
    if (error)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: error.details[0].message });

    await authService.forgotPasswordService(email);

    req.session.email = email;
    req.session.otpPurpose = "password-reset";

    return res
      .status(StatusCode.OK)
      .json({ success: true, message: ResponseMessage.OTP });
  } catch (err) {
    if (err.message === ResponseMessage.BAD_REQUEST) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: err.message });
    }
    console.error(err);
    return res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: err.message });
  }
};

const resetPasswordPost = async (req, res) => {
  try {
    if (!req.session.allowReset || !req.session.email) {
      return res
        .status(StatusCode.UNAUTHORIZED)
        .json({ success: false, message: ResponseMessage.UNAUTHORIZED });
    }

    const { error } = resetPasswordSchema.validate(req.body);
    if (error)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: error.details[0].message });

    await authService.resetPasswordService(
      req.session.email,
      req.body.password
    );

    req.session.allowReset = false;
    req.session.email = null;

    return res
      .status(StatusCode.OK)
      .json({ success: true, message: ResponseMessage.PASS_RES });
  } catch (err) {
    console.error(err);
    return res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const resendOtp = async (req, res) => {
  try {
    await authService.resendOtpService(req.session.email);
    req.session.otpExpiresAt = Date.now() + 1 * 60 * 1000;

    return res
      .status(StatusCode.OK)
      .json({ success: true, message: ResponseMessage.OTP_SUC });
  } catch (err) {
    if (err.message === ResponseMessage.OTP_EXP) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: err.message });
    }
    console.error(err);
    return res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.OTP_REJ });
  }
};

const googleCallback = async (req, res) => {
  try {
    const { email, name } = req.body || {};
    if (!email)
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Email required" });

    const user = await authService.googleAuthService({ email, name });

    req.session.user = user._id;

    return res.status(StatusCode.OK).json({
      success: true,
      message: ResponseMessage.LOGIN_SUCCESS,
      redirectUrl: "/user/home",
    });
  } catch (err) {
    if (err.message === ResponseMessage.USER_BLOCK) {
      return res
        .status(StatusCode.UNAUTHORIZED)
        .json({ success: false, message: err.message });
    }
    console.error("Google callback error:", err);
    return res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const loadRegister = (req, res) => res.render("user/register");
const loadLogin = (req, res) => res.render("user/login");
const forgotPassword = (req, res) => res.render("user/forgotPassword");

const loadVerifyOtp = (req, res) => {
  if (!req.session.email) return res.redirect("/user/register");
  res.render("user/verifyOtp", { otpExpiresAt: req.session.otpExpiresAt || 0 });
};

const loadResetPassword = (req, res) => {
  if (!req.session.allowReset) return res.redirect("/user/login");
  res.render("user/resetPassword");
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
  loadVerifyOtp,
  googleCallback,
};
