export const StatusCode = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
};

export const ResponseMessage = {
    // Success
    SUCCESS: "Operation successful",
    CREATED: "Resource created successfully",
    NEW_PASS: 'Password updated successfully',
    DUP_EMAIL: 'Email already exist',
    
    // Auth Errors
     REG_SUCCESS: "Registeration successful",
    LOGIN_SUCCESS: "Login successful",
    LOGOUT_SUCCESS: "Logout successful",
    AUTH_FAILURE: "Authentication failed",
    UNAUTHORIZED: "Unauthorized access",
    FORBIDDEN: "Access denied",

   //OTP
   OTP: 'OTP sent to mail!',
   OTP_EXP: 'Session expired — please try again.',
   OTP_SUC: 'OTP resent successfully.',
   OTP_REJ: 'Failed to resend otp.',
   INV_OTP: 'Invalid OTP! Please check and try again.',
   OTP_VER: 'OTP Verified! Redirecting...',
   EMAIL_VER: 'Email verified successfully!',

   PASS_RES: 'Password reset successfull',

  //Brand
  BRAND: 'Please upload a brand logo',
  DUP_BRAND: "Brand already exist",
  NEW_BRAND: 'New Brand added successfull',
  BRAND_STATUS: 'Brand updated successfully',

  //Product
  PRODUCT: 'Product added successfull',
    PRODUCT_STATUS: 'Product updated successfully',

  //Category
   DUP_CATEGORY: "Category already exist",
   CATEGORY_STATUS: 'Category updated successfully',

   //variants
   VAR_PIC: 'No file uploaded',
   VARIANT_NOT_FOUND: "Variant not found",
   VAR_IMG_SUC: 'Variant image updated successfully',

   //User
   USER_STATUS: 'User updated successfully',
   DUP_USER: "User already exist",
   VER_EMAIL: 'Please verify your email first',
   USER_BLOCK: 'You have been blocked by the admin',
   WRONG_PASS: 'Incorrect password',

    // Input/Logic Errors
    BAD_REQUEST: "Invalid request parameters",
    MISSING_FIELDS: "Please provide all required fields",
    INVALID_CREDENTIALS: "Invalid Credentials",
    USER_NOT_FOUND: "User not found",
    PRODUCT_NOT_FOUND: "Product not found",
    BRAND_NOT_FOUND: "Brand not found",
     CATEGORY_NOT_FOUND: "Category not found",
    
    // Server Errors
    SERVER_ERROR: "Internal Server Error",
   
};