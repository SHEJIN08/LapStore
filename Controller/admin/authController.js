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
  res.render("admin/login",{message: '',type: ''});
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
      return res.render("admin/login", {
        message: error.details[0].message,
        type: "error",
      });
    }

    // ✅ Step 2: Extract fields
    const { email, password } = req.body;

    // ✅ Step 3: Check if admin exists
    const admin = await adminSchema.findOne({ email });
    if (!admin) {
      return res.render("admin/login", {
        message: "Invalid Credentials",
        type: "error",
      });
    }

    // ✅ Step 4: Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render("admin/login", {
        message: "Invalid Credentials",
        type: "error",
      });
    }

    // ✅ Step 5: Login success
 req.session.admin = true;
 req.session.message = "Login successful"; // <-- Store message in session
 req.session.type = "success";         // <-- Store type in session
 res.redirect("/admin/dashboard");
  } catch (error) {
    console.error(error);
    res.render("admin/login", {
      message: "Something went wrong. Please try again later.",
      type: "error",
    });
  }
};

// 🧩 Load admin dashboard
const loadDashboard = async (req, res) => {
    // Get the message from the session
    const message = req.session.message || '';
    const type = req.session.type || '';

    // Delete it from the session so it only shows once
    delete req.session.message;
    delete req.session.type;

    // Render the dashboard, passing the one-time message
    res.render("admin/dashboard", {
        message: message,
        type: type
    });
};

// 📦 Export controller
const authController = {
  loadDashboard,
  loadLogin,
  login,
};

export default authController;
