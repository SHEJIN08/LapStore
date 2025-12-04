import Joi from "joi";
import adminSchema from "../../model/adminModel.js";
import bcrypt from "bcrypt";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";


// 🧩 Joi validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please enter a valid email address",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    
  }),
});

// 🧠 Load login page
const loadLogin = async (req, res) => {
  res.render("admin/login");
};

// ⚙️ Handle login logic
const login = async (req, res) => { 
  try {
    // ✅ Step 1: Validate input using Joi
   
    const { error } = loginSchema.validate(req.body,{
        abortEarly:false,
        allowUnknown: true
    });

    if (error) {
      return res.status(StatusCode.BAD_REQUEST).json({success: false, message: error.details[0].message})
    }

    // ✅ Step 2: Extract fields
    const { email, password } = req.body;

    // ✅ Step 3: Check if admin exists
    const admin = await adminSchema.findOne({ email });
     

    if (!admin) {
      return res.status(StatusCode.UNAUTHORIZED).json({success: false, message: ResponseMessage.INVALID_CREDENTIALS})
    }

    // ✅ Step 4: Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(StatusCode.UNAUTHORIZED).json({success: false, message: ResponseMessage.INVALID_CREDENTIALS})
    }

    // ✅ Step 5: Login success
 req.session.admin = admin._id;
 return res.status(StatusCode.OK).json({success: true, message: ResponseMessage.LOGIN_SUCCESS})
  } catch (error) {
    console.error(error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
  }
};

// 🧩 Load admin dashboard
const loadDashboard = async (req, res) => {
    res.render("admin/dashboard");
};

const logout = async (req,res) => {
  try{
   
    delete req.session.admin;
      
    res.redirect('/admin/login')
  }catch (error){
    console.error(error);

  }
}


// 📦 Export controller
const authController = {
  loadDashboard,
  loadLogin,
  login,
  logout,
};

export default authController;
