import userSchema  from "../../model/userModel.js"
import bcrypt from "bcrypt";

  const loadUsers = async (req,res) => {
    try {
        const search = req.query.search ||'';
        const status = req.query.status ||'all';


        // --- 2. Pagination parameters ---
        const page = Number.parseInt(req.query.page) || 1; // Get page number, default to 1
        const limit = 10; // Set a fixed number of users per page
        const skip = (page - 1) * limit; // Calculate how many documents to skip

        let query = {};
        
        if(status === 'active') {
            query.isActive = true;
            query.isVerified = true;
        } else if(status === 'blocked'){
             query.isActive = false;
             query.isVerified = true;
        } else if(status === 'pending'){
            query.isVerified = false;
        }

        if(search) {
            const searchRegex = new RegExp(search,'i')

            query.$or = [
                {name: searchRegex},
                {email: searchRegex},
                {userId: searchRegex}
            ];
        }

        // --- 4. Execute two queries ---
        //    Query 1: Get the total count of users matching the filter
        const totalUsers = await userSchema.countDocuments(query);
        
        //    Query 2: Get the actual users for the current page
        const users = await userSchema.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)   // <-- Add skip
            .limit(limit); // <-- Add limit

        // --- 5. Calculate total pages ---
        const totalPages = Math.ceil(totalUsers / limit);


        const message = req.session.message || ""
        const type = req.session.type || ""
        req.session.message = null
        req.session.type = null
    return  res.render('admin/users',{users:users,currentSearch: search,
            currentStatus: status,totalUsers: totalUsers,
            totalPages: totalPages,
            currentPage: page,
            limit: limit, message, type})
    } catch (err) {
        console.error(err)
        req.session.message = 'Something went wrong'
        req.session.type = 'error'
        res.status(500).send('Error loading users')
    }
}; 

const BlockOrUnblock = async (req,res) => {
    try {
        const userId = req.params.id;

        const user = await userSchema.findById(userId);
        if(!user){
           req.session.message = 'User not found'
           req.session.type = 'error'
            return res.redirect('/admin/users')
        }

        user.isActive = !user.isActive;
        await user.save();

        req.session.message = "User status changed successfully";
        req.session.type = 'success';

        res.redirect('/admin/users')
        
    } catch (err) {
        console.error(err)
        req.session.message = 'Something went wrong'
        req.session.type = 'error'
        return res.status(500).redirect('/admin/users')
    }
}


export default {loadUsers, BlockOrUnblock};
