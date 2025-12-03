import userSchema from '../model/userModel.js'

const checkSession = (req,res,next) => {
    if(req.session.user){
        next()
    }else{
       res.redirect('/user/login')
    }
}

const isLogin = (req,res,next) => {
    if(req.session.user){
        return res.redirect('/user/home')
    }else{
        next();
    }
}

const isUserBlocked = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await userSchema.findById(req.session.user);

            // 1. If user is blocked
            if (user && !user.isActive) {
                req.session.destroy((err) => {
                    if (err) {
                        console.log("Error destroying session:", err);
                      
                    }
                    
                    return res.redirect('/user/login');
                });
                return; 
            }
        }
        

        next();
        
    } catch (error) {
        console.error("Auth Middleware Error:", error);
        next(); 
    }
}
export default {checkSession ,isLogin, isUserBlocked};
