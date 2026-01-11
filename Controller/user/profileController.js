import profileService from "../../services/user/profileService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    
    const user = await profileService.getUserProfileService(userId);

    if (!user) {
      return res.redirect("/user/login");
    }

    res.render("user/userProfile", { user: user });

  } catch (error) {
    console.error(error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user?._id || req.session.user;

    if (!userId) {
      return res.status(StatusCode.UNAUTHORIZED).json({ success: false, message: ResponseMessage.UNAUTHORIZED });
    }

    if(newPassword.length === 0) return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Please fill the form'});
    if (newPassword.length < 6) return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: "Password must be atleast 6 characters" });

    await profileService.changePasswordService(userId, currentPassword, newPassword);

    res.status(StatusCode.OK).json({ success: true, message: ResponseMessage.NEW_PASS });

  } catch (error) {
  
    if (error.message === "Incorrect current password" || error.message === ResponseMessage.NOT_FOUND) {
        return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: error.message });
    }
    console.error(error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// --- EDIT INFO (Name/Email) ---
const editInfo = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.session.user?._id || req.session.user;

    const nameRegex = /^[a-zA-Z\s]+$/;

    if (!name || !nameRegex.test(name)) {
      return res.json({ 
        success: false, 
        message: "Invalid name format. Only letters and spaces are allowed." 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      return res.json({ 
        success: false, 
        message: "Invalid email address format." 
      });
    }
    
    //  Fetch current user to compare
    const currentUser = await profileService.getUserProfileService(userId);
    if (!currentUser) {
        return res.status(StatusCode.NOT_FOUND).json({ success: false, message: ResponseMessage.USER_NOT_FOUND });
    }

    // --- CASE 1: Only Name Changed (Direct Update) ---
    if (email === currentUser.email) {
      const updatedUser = await profileService.updateNameService(userId, name);
      
      // Update Session
      req.session.user = updatedUser;

      return res.json({ 
        success: true, 
        otpRequired: false, 
        message: "Profile updated successfully!" 
      });
    }

    // --- CASE 2: Email Changed (OTP Required) ---
    await profileService.initiateEmailChangeService(userId, email);

    // Setup Session for OTP Verify Step
    req.session.otpPurpose = "profile-update"; 
    req.session.email = email; 
    req.session.tempUpdateData = {
      newName: name,
      newEmail: email
    };

    res.json({ 
      success: true, 
      otpRequired: true, 
      message: "OTP sent to new email" 
    });

  } catch (error) {
    if (error.message === ResponseMessage.DUP_EMAIL) {
        return res.json({ success: false, message: ResponseMessage.DUP_EMAIL });
    }
    console.error("Error in editInfo:", error);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
  }
};

// --- UPDATE PROFILE PIC ---
const updateProfilePic = async (req, res) => {
  try {
    if(!req.file){
      return res.status(StatusCode.NOT_FOUND).json({success: false, message: "No file uploaded."});
    }

    const imageUrl = req.file.secure_url;
    const userId = req.session.user?._id || req.session.user; 

    await profileService.updateAvatarService(userId, imageUrl);

    res.redirect('/user/home/profile');

  } catch (error) {
    console.error(error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
  }
};

export default { loadProfile, changePassword, editInfo, updateProfilePic };