import userSchema from "../../model/userModel.js";
import { ResponseMessage } from "../../utils/statusCode.js";

// --- GET ALL USERS (Paginated, Search, Filter) ---
const getAllUsersService = async ({ search, status, page, limit }) => {
    const skip = (page - 1) * limit;
    let query = {};

    // 1. Status Filter
    if (status === 'active') {
        query.isActive = true;
        query.isVerified = true;
    } else if (status === 'blocked') {
        query.isActive = false;
        query.isVerified = true;
    } else if (status === 'pending') {
        query.isVerified = false;
    }

    // 2. Search Filter
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { name: searchRegex },
            { email: searchRegex },
            { userId: searchRegex }
        ];
    }

    // 3. Fetch Data
    const users = await userSchema.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    // 4. Count Totals
    const totalUsers = await userSchema.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    return { users, totalUsers, totalPages };
};


const searchUsersForCoupon = async (searchQuery) => {
    try {
        const query = {
            isAdmin: { $ne: true }, 
            isActive: true,        
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } }
            ]
        };

        const users = await userSchema.find(query)
            .select('name email _id') 
            .limit(7); 

        return users;
    } catch (error) {
        throw new Error("Error searching users");
    }
};

// --- TOGGLE USER STATUS (Block/Unblock) ---
const toggleUserStatusService = async (userId) => {
    const user = await userSchema.findById(userId);
    
    if (!user) {
        throw new Error(ResponseMessage.USER_NOT_FOUND);
    }

    user.isActive = !user.isActive;
    await user.save();
    
    return user;
};

export default {
    getAllUsersService,
    searchUsersForCoupon,
    toggleUserStatusService
};