import Referral from "../../model/referralModel.js";
import Wallet from "../../model/walletModel.js";
import walletTransactions from "../../model/walletTransactionsModel.js";
import User from "../../model/userModel.js";

const userReferrerData = async (userId) => {
  const user = await User.findById(userId, "referralCode name email avatar");

  //get referred history
  const referrals = await Referral.find({ referrerId: userId })
    .populate("refereeId", "name email createdAt avatar")
    .sort({ createdAt: -1 });

  const totalEarnings = referrals.reduce((acc, curr) => {
    return curr.status === "Completed" ? acc + curr.referralAmount : acc;
  }, 0);

  return {
    user,
    referrals,
    totalEarnings,
    successfulCount: referrals.filter((r) => r.status === "Completed").length,
  };
};

const checkAndCreditReferral = async (userId) => {
  try {
    const referral = await Referral.findOne({
      refereeId: userId,
      status: "Pending",
    });
    if (!referral) {
      return;
    }
    referral.status = "Completed";
    await referral.save();

    let referralWallet = await Wallet.findOne({ userId: referral.referrerId });

    if (!referralWallet) {
      referralWallet = new Wallet({
        userId: referral.referrerId,
        balance: referral.referralAmount,
      });
    } else {
      referralWallet.balance += referral.referralAmount;
    }
    await referralWallet.save();

    await walletTransactions.create({
      userId: referral.referrerId,
      walletId: referralWallet ? referralWallet._id : null,
      amount: referral.referralAmount,
      type: "credit",
      reason: "referral_bonus",
      description: "Referral Bonus for user registration",
    });
    console.log(
      `Referral reward of ${referral.referralAmount} credited to ${referral.referrerId}`
    );
    return true;
  } catch (error) {
    console.error("Referral Credit Error:", error);
  }
};

export default { userReferrerData, checkAndCreditReferral };
