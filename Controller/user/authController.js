import Joi from "joi"; // 1. Import Joi
import bcrypt from "bcrypt";
import userSchema from "../../model/userMode.js";

const saltround = 10;

// 2. Define your Joi validation schema
const registerSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Name is required.",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Please enter a valid email address.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 6 characters long.",
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match.',
    'string.empty': 'Please confirm your password.'
  })
});

const registerUser = async (req, res) => {
  try {
    // 3. Validate req.body first
    const { error } = registerSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true, // Good practice in case of hidden fields
    });

    // 4. Handle validation failure
    if (error) {
      req.session.message = error.details[0].message; // Send Joi's error message
      req.session.type = "error";
      return req.session.save(() => {
        res.redirect("/user/register");
      });
      
    }

    // Validation passed, proceed with your logic
    const { name, email, password } = req.body;
    const user = await userSchema.findOne({ email });

    if (user) {
      req.session.message = "User already exists";
      req.session.type = "error";
      return req.session.save(() => {
        res.redirect("/user/register");
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltround);
    const newUser = new userSchema({ name, email, password: hashedPassword });
    await newUser.save();

    req.session.message = "User registration successful, please log in";
    req.session.type = "success";
    return req.session.save(() => {
        res.redirect("/user/login");
      });
  } catch (err) {
    console.error(err);
    // 5. Updated catch block message
    req.session.message = "An unexpected error occurred. Please try again.";
    req.session.type = "error";
    return req.session.save(() => {
        res.redirect("/user/register");
      });
  }
};

const loadRegister = (req, res) => {
  const message = req.session.message || "";
  const type = req.session.type || "";
  
  // Clear the message from session
  req.session.message = null; 
  req.session.type = null;

  res.render("user/register", { message, type });
};

const loadLogin = (req, res) => {
  const message = req.session.message || "";
  const type = req.session.type || "";
  
  // Clear the message from session so it only shows once
  req.session.message = null; 
  req.session.type = null;

  // Make sure your login EJS file is 'user/login'
  res.render("user/login", { message, type });
};

export default { registerUser, loadRegister, loadLogin };