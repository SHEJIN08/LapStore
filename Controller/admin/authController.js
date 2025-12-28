import Joi from "joi";
import adminAuthService from "../../services/admin/authService.js";
import salesService from "../../services/admin/salesService.js";
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
    const { error } = loginSchema.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
    });

    if (error) {
      return res.status(StatusCode.BAD_REQUEST).json({
          success: false, 
          message: error.details[0].message
      });
    }

    // ✅ Step 2: Extract fields
    const { email, password } = req.body;

    // ✅ Step 3: Call Service
    const admin = await adminAuthService.loginAdminService(email, password);

    // ✅ Step 4: Login success (Set Session)
    req.session.admin = admin._id;
    
    return res.status(StatusCode.OK).json({
        success: true, 
        message: ResponseMessage.LOGIN_SUCCESS
    });

  } catch (error) {
    // Handle Invalid Credentials explicitly
    if (error.message === ResponseMessage.INVALID_CREDENTIALS) {
        return res.status(StatusCode.UNAUTHORIZED).json({
            success: false, 
            message: ResponseMessage.INVALID_CREDENTIALS
        });
    }

    console.error("Admin Login Error:", error);
    return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
        success: false, 
        message: ResponseMessage.SERVER_ERROR
    });
  }
};

// 🧩 Load admin dashboard
const loadDashboard = async (req, res) => {
 try {
        // 1. Fetch the full report data (Default to 'monthly' or 'yearly')
        // We call 'getSalesReportService' because it returns EVERYTHING: summary, chartData, and orders.
        const reportData = await salesService.getSalesReportService({ 
            reportType: 'monthly', 
            page: 1, 
            limit: 5 // Limit to 5 for the "Recent Orders" table in dashboard
        });

        // 2. Render the dashboard and PASS THE DATA
        res.render('admin/dashboard', { 
            activePage: 'dashboard',
            
            // Pass the specific parts the EJS needs
            summary: reportData.summary,       // Fixes "summary is not defined"
            chartData: reportData.chartData,   // Fixes the Graph
            orders: reportData.orders          // Fixes the Recent Orders table
        });

    } catch (error) {
        console.log("Dashboard Error:", error);
        res.render('admin/error/500');
    }
};

const filterChartData = async (req,res) => {
  try {
    const { filter } = req.query;
    
    const data = await salesService.getSalesChartData(filter)

    res.json(data);
  } catch (error) {
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
  }
}

// 🚪 Logout
const logout = async (req, res) => {
  try {
    delete req.session.admin;
    res.redirect('/admin/login');
  } catch (error) {
    console.error("Logout Error:", error);
    res.redirect('/admin/login');
  }
};

// 📦 Export controller
const authController = {
  loadDashboard,
  loadLogin,
  filterChartData,
  login,
  logout,
};

export default authController;