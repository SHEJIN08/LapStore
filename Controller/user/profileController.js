import User from "../../model/userModel.js";
import bcrypt from "bcrypt";
import UserOtpVerification from "../../model/otpModel.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";
import emailService from '../../utils/nodeMailer.js'
const transporter = emailService.transporter;
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user;

    const user = await User.findById(userId);

    if (!user) {
      res.redirect("/user/login");
    }

    res.render("user/userProfile", {
      user: user,
    });

  } catch (error) {
    console.error(error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};



const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user || req.session.user?._id;

    if (!userId) {
      return res
        .status(StatusCode.UNAUTHORIZED)
        .json({ success: false, message: ResponseMessage.UNAUTHORIZED });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ success: false, message: ResponseMessage.NOT_FOUND });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ success: false, message: "Incorrect current password" });
    }
    if(newPassword.length === 0){
        return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please fill the form'})
    }

    if (newPassword.length < 6) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({
          success: false,
          message: "Password must be atleast 6 characters",
        });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res
      .status(StatusCode.OK)
      .json({ success: true, message: ResponseMessage.NEW_PASS });
  } catch (error) {
    console.error(error);
    return res
      .status(StatusCode.SERVER_ERROR)
      .json({ success: false, message: SERVER_ERROR });
  }
};

const editInfo = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.session.user?._id || req.session.user;

    // Fetch the current user to compare data
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(StatusCode.NOT_FOUND).json({ success: false, message: ResponseMessage.USER_NOT_FOUND });
    }

    // --- CASE 1: Email is the SAME (Only updating Name) ---
    if (email === currentUser.email) {
      
      // Update name directly
      currentUser.name = name;
      await currentUser.save();

      // Update Session
      req.session.user = currentUser;

      // Return success with a specific flag 'otpRequired: false'
      return res.json({ 
        success: true, 
        otpRequired: false, 
        message: "Profile updated successfully!" 
      });
    }

    // --- CASE 2: Email is DIFFERENT (Security Check Needed) ---
    
    // Check if new email is taken by someone else
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.json({ success: false, message: ResponseMessage.DUP_EMAIL });
    }

    // Generate & Send OTP
    const otp = generateOTP();
    console.log("Generated OTP:", otp);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email, 
      subject: "Profile Update Verification",
      text: `Your OTP for updating your profile is: ${otp}`,
    };
    await transporter.sendMail(mailOptions);

    // Save OTP to DB
    await UserOtpVerification.deleteMany({ email: email });
    const newOtpVerification = new UserOtpVerification({
      userId: userId,
      email: email,
      otpCode: otp,
    });
    await newOtpVerification.save();

    // Setup Session for Verify Step
    req.session.otpPurpose = "profile-update"; 
    req.session.email = email; 
    req.session.tempUpdateData = {
      newName: name,
      newEmail: email
    };

    // Return success with 'otpRequired: true'
    res.json({ 
      success: true, 
      otpRequired: true, 
      message: "OTP sent to new email" 
    });

  } catch (error) {
    console.error("Error in editInfo:", error);
    res
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const updateProfilePic = async (req,res) => {
  try {
    if(!req.file){
      return res.status(StatusCode.NOT_FOUND).json({success: false, message: "No file uploaded or file format not supported."})
    }
   

    const imageUrl = req.file.secure_url;

    await User.findByIdAndUpdate(req.session.user, {
      avatar: imageUrl
    })


    res.redirect('/user/home/profile')

  } catch (error) {
    console.error(error)
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
  }
}
export default { loadProfile, changePassword , editInfo, updateProfilePic};
