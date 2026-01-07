import User from "../../model/userModel.js";
import walletService from "../../services/user/walletService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";

const loadWallet = async (req,res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId)
        const page = parseInt(req.query.page) || 1;
        const filter = req.query.type || 'all';

        const {wallet, transactions, totalPages, currentPage} = await walletService.getWalletData(userId, page, filter)

        res.render('user/wallet', {
            user: userData,
            wallet,
            transactions,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            currentFilter: filter,
            currentPage: currentPage,
            totalPages: totalPages
        })
    } catch (error) {
        console.log(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const addMoneyToWallet = async (req,res) => {
    try {
        const { amount } = req.body

        if(!amount || amount < 1){
            return res.status(StatusCode.BAD_REQUEST).json({success: false, message: 'Invalid amount'})
        }

        const order = await walletService.initiateAddMoney(amount)
        res.json({success: true, order})
    } catch (error) {
        console.log(error)
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR})
    }
}

const verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.session.user;

     
        await walletService.verifyAndCreditWallet(
            userId, 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature
        );

        res.json({ success: true, message: "Money added successfully!" });

    } catch (error) {
        console.error("Verify Payment Error:", error);
        res.json({ success: false, message: error.message || "Payment verification failed" });
    }
};

export default {loadWallet, addMoneyToWallet, verifyWalletPayment}