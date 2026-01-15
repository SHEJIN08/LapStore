import adminSchema from "../../model/adminModel.js";
import bcrypt from "bcrypt";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- ADMIN LOGIN LOGIC ---
const loginAdminService = async (email, password) => {
  // 1. Check if admin exists
  const admin = await adminSchema.findOne({ email });

  if (!admin) {
    throw new Error(ResponseMessage.INVALID_CREDENTIALS);
  }

  // 2. Compare password
  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    throw new Error(ResponseMessage.INVALID_CREDENTIALS);
  }

  return admin;
};

export default {
  loginAdminService,
};
