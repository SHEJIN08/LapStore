import dotenv from "dotenv";
dotenv.config();
import nodeMailer from "./nodeMailer.js";

import UserOtpVerification from "../model/otpModel.js";

const transporter = nodeMailer.transporter;

export const sendOtp = async (email) => {
  try {
    // Generate OTP
    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;

    await UserOtpVerification.deleteMany({ email });

    // Save to DB using correct field name
    await UserOtpVerification.create({
      email: email,
      otpCode: otp,
      createdAt: new Date(),
    });

    // Send OTP email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
      html: `
        <h2>Your OTP is: <b>${otp}</b></h2>
        <p>This OTP is valid for 1 minutes.</p>
      `,
    });

    console.log("OTP sent and saved:", otp);
    return otp;
  } catch (err) {
    console.error("Error sending OTP:", err);
    return null;
  }
};
