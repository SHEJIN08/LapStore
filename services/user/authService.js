
import bcrypt from "bcrypt";
import userSchema from "../../model/userModel.js"
import UserOtpVerification from "../../model/otpModel.js";
import { sendOtp } from "../../utils/otp.js";
import { ResponseMessage } from "../../utils/statusCode.js";

const saltround = 10;

// --- REGISTER SERVICE ---
const registerUserService = async ({ name, email, password }) => {
    // 1. Check existing user
    const existingUser = await userSchema.findOne({ email });
    if (existingUser) {
        throw new Error(ResponseMessage.DUP_USER); // Throw error to be caught by controller
    }

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(password, saltround);
    const userId = `user_${Date.now()}`;

    // 3. Create User
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
    
    return newUser;
};

// --- LOGIN SERVICE ---
const loginUserService = async ({ email, password }) => {
    const user = await userSchema.findOne({ email });

    if (!user) throw new Error(ResponseMessage.USER_NOT_FOUND);
    if (!user.isVerified) throw new Error(ResponseMessage.VER_EMAIL);
    if (!user.isActive) throw new Error(ResponseMessage.USER_BLOCK);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error(ResponseMessage.WRONG_PASS);

    return user;
};

// --- FORGOT PASSWORD SERVICE ---
const forgotPasswordService = async (email) => {
    const user = await userSchema.findOne({ email });
    if (!user) throw new Error(ResponseMessage.BAD_REQUEST);

    await sendOtp(email);
    return true;
};

// --- RESET PASSWORD SERVICE ---
const resetPasswordService = async (email, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, saltround);
    
    await userSchema.updateOne(
        { email: email },
        { password: hashedPassword }
    );
    return true;
};

// --- RESEND OTP SERVICE ---
const resendOtpService = async (email) => {
    if (!email) throw new Error(ResponseMessage.OTP_EXP);

    await UserOtpVerification.deleteMany({ email });
    await sendOtp(email);
    return true;
};

// --- GOOGLE AUTH SERVICE ---
const googleAuthService = async ({ email, name }) => {
    let user = await userSchema.findOne({ email });

    if (!user) {
        const newUserId = `google_${Date.now()}`;
        user = new userSchema({
            userId: newUserId,
            name: name || 'Google User',
            email,
            password: 'oauth_google',
            isVerified: true,
            isActive: true
        });
        await user.save();
    }

    if (!user.isActive) throw new Error(ResponseMessage.USER_BLOCK);

    return user;
};

export default {
    registerUserService,
    loginUserService,
    forgotPasswordService,
    resetPasswordService,
    resendOtpService,
    googleAuthService
};