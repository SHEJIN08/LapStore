import mongoose  from "mongoose";
import Order from "../../model/orderModel.js";

const getSalesReportService = async ({ reportType, startDate, endDate, page = 1, limit = 10}) => {
    try {
        const now = new Date();
        let start = new Date();
        let end = new Date();
        end.setHours(23,59,59,999);

        if(reportType === 'daily'){
            start.setHours(0, 0, 0, 0)
        } else if(reportType === 'weekly'){
            start.setDate(now.getDate() - 7)
            start.setHours(0, 0, 0, 0)
        } else if(reportType === 'monthly'){
            start.setDate(1);
            start.setHours(0, 0, 0, 0)
        }else if(reportType === 'yearly'){
            start.setMonth(0, 1)
            start.setHours(0, 0, 0, 0)
        }else if(reportType === 'custom' && startDate && endDate){
            start = new Date(startDate)
            end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
        }

        const commonPipeline = [
            {$match: {createdAt: {$gte: start, $lte: end}}},
            {$unwind: '$orderedItems'},
            {$match: { "orderedItems.productStatus": {$in: ['Delivered' , 'Return Rejected']} }}
        ]

        const stats = await Order.aggregate([
            ...commonPipeline,
            {
             $group: {
                    _id: "$_id",
                    orderSubtotal: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
                    totalItemsInOrder: { $sum: "$orderedItems.quantity" }
                }
            },
            {
                $addFields: {
                    // Tax: 5% (0.05). If you meant exactly 0.05%, change 0.05 to 0.0005
                    taxAmount: { $multiply: ["$orderSubtotal", 0.05] }, 
                    
                    // Shipping: 100 if subtotal < 100,000
                    shippingFee: { 
                        $cond: { if: { $lt: ["$orderSubtotal", 100000] }, then: 100, else: 0 } 
                    }
                }
            },
            {
                $addFields: {
                    finalOrderRevenue: { $add: ["$orderSubtotal", "$taxAmount", "$shippingFee"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSales: { $sum: "$finalOrderRevenue" },
                    totalItemsSold: { $sum: "$totalItemsInOrder" },
                    // If you track discount per item, sum it here.
                }
            }
        ])

        const summary = {
         totalOrders: stats[0] ? stats[0].totalOrders : 0,
            totalSales: stats[0] ? stats[0].totalSales : 0,
            totalDiscount: 0, 
            totalItems: stats[0] ? stats[0].totalItemsSold : 0
        }

        const skip = (page - 1) * limit;

        const tableData = await Order.aggregate([
            ...commonPipeline,
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: "_id",
                    as: 'userDetails'
                }
            },
            {$unwind: { path: '$userDetails', preserveNullAndEmptyArrays : true}},
        
            {
                $group: {
                    _id: "$_id",
                    orderId: { $first: '$orderId'},
                  date: { $first: "$createdAt" },
                    customerName: { $first: "$address.fullName" },
                    customerEmail: { $first: "$userDetails.email" },
                    paymentMethod: { $first: "$paymentMethod" },
                    // Reconstruct the filtered items array
                    deliveredItems: { $push: "$orderedItems" },
                    // Calculate Total for this specific row (Sum of delivered items only)
                subtotal: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } }
                }
            },
            {
                $addFields: {
                    tax: { $multiply: ["$subtotal", 0.05] }, // 5% Tax
                    shipping: { 
                        $cond: { if: { $lt: ["$subtotal", 100000] }, then: 100, else: 0 } 
                    }
                }
            },
            {
                $addFields: {

                    rowTotal: { $add: ["$subtotal", "$tax", "$shipping"] }
                }
            },
            { $sort: { date: -1 } },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            }
        ]);

        const orders = tableData[0].data;
        const totalCount = tableData[0].metadata[0] ? tableData[0].metadata[0].total : 0;
        const totalPages = Math.ceil(totalCount / limit);

        summary.totalOrders = totalCount;

        return {
            orders,
            summary,
            totalPages,
            currentPage: parseInt(page),
            dateRange: {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            }
        };
        
    } catch (error) {
        throw new Error(error.message);
    }
}

export default { getSalesReportService };
