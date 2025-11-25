import Joi from "joi";
import adminSchema from "../../model/adminModel.js";
import bcrypt from "bcrypt";

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
      return res.status(400).json({success: false, message: error.details[0].message})
    }

    // ✅ Step 2: Extract fields
    const { email, password } = req.body;

    // ✅ Step 3: Check if admin exists
    const admin = await adminSchema.findOne({ email });
    if (!admin) {
      return res.status(401).json({success: false, message: 'Invalid  Credentials'})
    }

    // ✅ Step 4: Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({success: false, message: 'Invalid  Credentials'})
    }

    // ✅ Step 5: Login success
 req.session.admin = true;
 return res.status(200).json({success: true, message: "Login successful"})
  } catch (error) {
    console.error(error);
    return res.status(500).json({success: false, message: 'Something went wrong'})
  }
};

// 🧩 Load admin dashboard
const loadDashboard = async (req, res) => {
 

    // Render the dashboard, passing the one-time message
    res.render("admin/dashboard");
};

const logout = (req,res) => {
  req.session.admin = null;
    
  res.redirect('/admin/login')
}

// 📦 Export controller
const authController = {
  loadDashboard,
  loadLogin,
  login,
  logout
};

export default authController;
