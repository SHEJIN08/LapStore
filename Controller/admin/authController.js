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
      const defaultFilter = { reportType: 'monthly' };

        // We fetch everything using the default filter (Monthly)
        const [reportData, topProducts, topCategories, topBrands, countStatus, activeUserCount] = await Promise.all([
            salesService.getSalesReportService({ ...defaultFilter, page: 1, limit: 5 }),
            salesService.getBestSellingProducts(defaultFilter),
            salesService.getBestSellingCategory(defaultFilter),
            salesService.getBestSellingBrand(defaultFilter),
            salesService.getOrderStatus(defaultFilter),
            salesService.activeUsersCount()
        ]);

        res.render('admin/dashboard', { 
            summary: reportData.summary,       
            chartData: reportData.chartData,   
            orders: reportData.orders,
            topProducts,
            topCategories,
            topBrands,
            orderStatusData: countStatus,
            activeUser: activeUserCount       
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

const filterDashboardData = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        
        // Prepare the filter object
        const queryFilter = { 
            reportType: filter, 
            startDate: startDate, 
            endDate: endDate 
        };

        // Fetch ALL data in parallel with the new dates
        const [reportData, topProducts, topCategories, topBrands, countStatus] = await Promise.all([
            salesService.getSalesReportService({ ...queryFilter, page: 1, limit: 5 }),
            salesService.getBestSellingProducts(queryFilter),
            salesService.getBestSellingCategory(queryFilter),
            salesService.getBestSellingBrand(queryFilter),
            salesService.getOrderStatus(queryFilter)
        ]);

        // Return JSON to the frontend
        res.json({
            success: true,
            data: {
                summary: reportData.summary,
                chartData: reportData.chartData,
                orders: reportData.orders,
                topProducts,
                topCategories,
                topBrands,
                orderStatusData: countStatus
            }
        });

    } catch (error) {
        console.error("Filter API Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
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
  filterDashboardData,
  login,
  logout,
};

export default authController;