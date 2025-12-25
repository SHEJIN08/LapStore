import bcrypt from "bcrypt";
import userSchema from "../../model/userModel.js"
import Wallet from "../../model/walletModel.js";
import walletTransactions from "../../model/walletTransactionsModel.js";
import UserOtpVerification from "../../model/otpModel.js";
import Refferal from "../../model/referralModel.js";
import { sendOtp } from "../../utils/otp.js";
import { ResponseMessage } from "../../utils/statusCode.js";

const saltround = 10;

//function to generate refferalCode
const generateUniqueReferralCode = async (name) => {
    let result = '';
    const prefix = name.slice(0, 4).toUpperCase();
    let isUnique = false;

    while (!isUnique) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        result = `${prefix}${randomNum}`;
    
        const existingUser = await userSchema.findOne({ referralCode: result });
        if (!existingUser) {
            isUnique = true; 
        }
    }
    return result;
};

// --- REGISTER SERVICE ---
const registerUserService = async ({ name, email, password,referralCodeInput }) => {
    // 1. Check existing user
    const existingUser = await userSchema.findOne({ email });
    if (existingUser) {
        throw new Error(ResponseMessage.DUP_USER); // Throw error to be caught by controller
    }

    const newReferralCode = await generateUniqueReferralCode(name)

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(password, saltround);
    const userId = `user_${Date.now()}`;

    // 3. Create User
    const newUser = new userSchema({
        userId,
        name,
        email,
        password: hashedPassword,
        referralCode: newReferralCode,
        isVerified: false,
    });

    const savedUser = await newUser.save();

    if(referralCodeInput){
        const referrer = await userSchema.findOne({referralCode: referralCodeInput});

        if(referrer && referrer._id.toString() !== savedUser._id.toString()){
            await Refferal.create({
                referrerId: referrer._id,
                refereeId: savedUser._id,
                referralAmount: 200,
                status: 'Pending'
            })
            let wallet = await Wallet.findOne({userId: savedUser._id})
            if(!wallet){
                wallet = new Wallet({userId: savedUser._id, balance: 0})
            }

            const SIGNUP_BONUS = 100;
            wallet.balance += SIGNUP_BONUS;
            await wallet.save()

            await walletTransactions.create({
                userId: savedUser._id,
                walletId: wallet._id,
                amount: SIGNUP_BONUS,
                type: 'credit',
                reason: 'referral_bonus',
                description: 'Welcome bonus for using referral code'
            })
        }
    }

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

        const newReferralCode = await generateUniqueReferralCode(name);

        user = new userSchema({
            userId: newUserId,
            name: name || 'Google User',
            email,
            password: 'oauth_google',
            referralCode: newReferralCode,
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