import userManagementService from "../../services/admin/userService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

// --- LOAD USERS PAGE ---
const loadUsers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        // Call Service
        const { users, totalUsers, totalPages } = await userManagementService.getAllUsersService({
            search, status, page, limit
        });

        res.render('admin/users', {
            users: users,
            currentSearch: search,
            currentStatus: status,
            totalUsers: totalUsers,
            totalPages: totalPages,
            currentPage: page,
            limit: limit
        });

    } catch (err) {
        console.error(err);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ResponseMessage.SERVER_ERROR 
        });
    }
};

// --- BLOCK / UNBLOCK USER ---
const BlockOrUnblock = async (req, res) => {
    try {
        const userId = req.params.id;

        await userManagementService.toggleUserStatusService(userId);

        return res.status(StatusCode.OK).json({ 
            success: true, 
            message: ResponseMessage.USER_STATUS 
        });

    } catch (err) {
        if (err.message === ResponseMessage.USER_NOT_FOUND) {
            return res.status(StatusCode.BAD_REQUEST).json({ 
                success: false, 
                message: ResponseMessage.USER_NOT_FOUND 
            });
        }
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ResponseMessage.SERVER_ERROR 
        });
    }
};

export default { loadUsers, BlockOrUnblock };