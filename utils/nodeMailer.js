import dotenv from 'dotenv';
dotenv.config();

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port:587,
  secure:false,
  auth: {
    user: process.env.EMAIL_USER,     // Your Gmail
    pass: process.env.EMAIL_PASS   // 16-character App Password
  }
});

export default {transporter}


