import userSchema  from "../../model/userModel.js"

  const loadUsers = async (req,res) => {
    try {
        const users = await userSchema.find()
         const message = req.session.message || ""
        const type = req.session.type || ""
        req.session.message = null
        req.session.type = null
    return  res.render('admin/users',{users, message, type})
    } catch (err) {
        console.error(err)
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
        return res.status(500).redirect('/admin/users')
    }
}

const DeleteUser = async (req,res) => {
    try {
        const userId = req.params.id;
        const deleteUser = await userSchema.findByIdAndDelete(userId);

        if(!deleteUser){
            req.session.message = 'User not found for delete'
            req.session.type = 'error';
        }
         req.session.message = 'User deleted Successfully'
        req.session.type = 'success'
       res.redirect('/admin/users')
    } catch (err) {
        console.error(err);
        req.session.message = 'Something went wrong'
        req.session.type = 'error'
    }
}

const EditUser = async (req,res) => {
    try {
        const userId = req.params.id;
        
        // Get all the data from the form (req.body)
        const { name, email, phone, address, isActive } = req.body;

        // Find the user by _id and update them
        await userSchema.findByIdAndUpdate(userId, {
            name: name,
            email: email,
            phone: phone,         // <-- Will save if in schema
            address: address,       // <-- Will save if in schema
            isActive: (isActive === 'true') // Convert "true" string to boolean
        });

         req.session.message = 'User edited Successfully'
        req.session.type = 'success'
        res.redirect('/admin/users');

    } catch (error) {
        console.error('Error updating user:', error);
         req.session.message = 'Something went wrong'
        req.session.type = 'error'
        res.redirect('/admin/users');
    }
};

export default {loadUsers, BlockOrUnblock, DeleteUser, EditUser};
