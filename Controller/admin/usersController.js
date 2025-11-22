import userSchema  from "../../model/userModel.js"


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


       
    return  res.render('admin/users',{users:users,currentSearch: search,
            currentStatus: status,totalUsers: totalUsers,
            totalPages: totalPages,
            currentPage: page,
            limit: limit})
    } catch (err) {
        console.error(err)
        res.status(500).json({success: false, message: 'Something went wrong'})
    }
}; 

const BlockOrUnblock = async (req,res) => {
    try {
        const userId = req.params.id;

        const user = await userSchema.findById(userId);
        if(!user){
          return   res.status(400).json({success: false, message: 'User not found'})
        }

        user.isActive = !user.isActive;
        await user.save();
        return  res.status(200).json({success: true, message: 'User status changed successfully'})
        
    } catch (err) {
        console.error(err)
        return   res.status(500).json({success: false, message: 'Something went wrong'})
    }
}


export default {loadUsers, BlockOrUnblock};
