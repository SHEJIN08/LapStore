

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
export default {checkSession ,isLogin};