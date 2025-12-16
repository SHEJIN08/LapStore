import User from "../../model/userModel.js";
import UserOtpVerification from "../../model/otpModel.js";
import bcrypt from "bcrypt";
import emailService from '../../utils/nodeMailer.js';
import { ResponseMessage } from "../../utils/statusCode.js";

const transporter = emailService.transporter;

// --- HELPER: Generate OTP ---
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// --- GET PROFILE ---
const getUserProfileService = async (userId) => {
    return await User.findById(userId);
};

// --- CHANGE PASSWORD ---
const changePasswordService = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user) throw new Error(ResponseMessage.NOT_FOUND);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new Error("Incorrect current password");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();
    
    return true;
};

// --- UPDATE NAME ONLY ---
const updateNameService = async (userId, name) => {
    const user = await User.findById(userId);
    if (!user) throw new Error(ResponseMessage.USER_NOT_FOUND);

    user.name = name;
    await user.save();
    return user;
};

// --- INITIATE EMAIL CHANGE (Check Duplicate + Send OTP) ---
const initiateEmailChangeService = async (userId, email) => {
    // 1. Check if email is taken
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
        throw new Error(ResponseMessage.DUP_EMAIL);
    }

    // 2. Generate OTP
    const otp = generateOTP();
    console.log("Generated OTP:", otp);

    // 3. Send Email
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email, 
        subject: "Profile Update Verification",
        text: `Your OTP for updating your profile is: ${otp}`,
    };
    await transporter.sendMail(mailOptions);

    // 4. Save OTP to DB
    await UserOtpVerification.deleteMany({ email: email });
    const newOtpVerification = new UserOtpVerification({
        userId: userId,
        email: email,
        otpCode: otp,
    });
    await newOtpVerification.save();

    return otp; // Returning OTP just for logging if needed, or return true
};

// --- UPDATE AVATAR ---
const updateAvatarService = async (userId, imageUrl) => {
    await User.findByIdAndUpdate(userId, { avatar: imageUrl });
    return true;
};

export default {
    getUserProfileService,
    changePasswordService,
    updateNameService,
    initiateEmailChangeService,
    updateAvatarService
};