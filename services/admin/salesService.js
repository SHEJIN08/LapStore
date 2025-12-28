import mongoose  from "mongoose";
import Order from "../../model/orderModel.js";

// 2. NEW FUNCTION: ONLY FOR CHART

const getSalesChartData = async (reportType) => {
    try {
        const now = new Date();

        // 1. CONFIGURATION
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 Hours 30 Mins in Milliseconds
        const MY_TIMEZONE = "+05:30"; 

        // 2. CALCULATE "TODAY" IN IST
        // We create a new date that represents "Now" in IST
        const istNow = new Date(now.getTime() + IST_OFFSET);

        let start = new Date();
        let end = new Date();
        end.setHours(23, 59, 59, 999);  

        let dateFormat = "%Y-%m-%d"; // Default: Daily

        if (reportType === 'yearly') {
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            dateFormat = "%Y-%m"; 
        } else if (reportType === 'monthly') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            dateFormat = "%Y-%m-%d";
        } else if (reportType === 'weekly') {
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            dateFormat = "%Y-%m-%d";
        }else if (reportType === 'daily') {
          // === FORCE IST START TIME ===
            // 1. Take current IST time, flatten to midnight
            istNow.setUTCHours(0, 0, 0, 0);
            
            // 2. Subtract the offset to get the UTC timestamp for "00:00 IST"
            // Example: 00:00 IST becomes 18:30 UTC (Previous Day)
            start = new Date(istNow.getTime() - IST_OFFSET);
            
            // 3. End of day is just 24 hours later (minus 1ms)
            end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);

            dateFormat = "%H:00"; // Group by Hour   
        }
         else {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }

        const chartData = await Order.aggregate([
            // 1. Filter Orders by Date
            { $match: { createdAt: { $gte: start, $lte: end } } },
            
            // 2. Unwind Items to check status
            { $unwind: '$orderedItems' },
            
            // 3. Filter valid items only
            { $match: { "orderedItems.productStatus": { $in: ['Delivered', 'Return Rejected'] } } },
            {
                $group: {
                    _id: "$_id",
                    orderDate: { $first: "$createdAt" },
                    
                    // Simple Math: Price * Quantity
                    orderSubtotal: { 
                        $sum: { 
                            $multiply: ["$orderedItems.price", "$orderedItems.quantity"] 
                        } 
                    },
                    
                    // Capture Coupon (Handle if missing)
                    couponDiscount: { $first: { $ifNull: ["$discount", 0] } }
                }
            },

            // 5. APPLY TAX & SHIPPING LOGIC (Replicating your rules)
            {
                $addFields: {
                    taxAmount: { $multiply: ["$orderSubtotal", 0.05] }, // 5% Tax
                    shippingFee: {
                        $cond: { if: { $lt: ["$orderSubtotal", 100000] }, then: 100, else: 0 }
                    }
                }
            },

            // 6. CALCULATE FINAL REVENUE PER ORDER
            {
                $addFields: {
                    finalOrderRevenue: { 
                        $subtract: [
                            { $add: ["$orderSubtotal", "$taxAmount", "$shippingFee"] },
                            "$couponDiscount" 
                        ]
                    }
                }
            },

            // 7. FINAL GROUPING BY DATE (For the Graph)
          {
                $group: {
                    _id: { 
                        $dateToString: { 
                            format: dateFormat, 
                            date: "$orderDate",
                            timezone: MY_TIMEZONE  // Ensures labels are 9:00, 10:00 (IST) not 4:00 (UTC)
                        } 
                    },
                    totalSales: { $sum: "$finalOrderRevenue" },
                    count: { $sum: 1 }
                }
            },
            
            { $sort: { _id: 1 } }
        ]);


        return {    
            chartData: chartData
        }

    } catch (error) {
        throw new Error(error.message);
    }
}

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
            {$match: { "orderedItems.productStatus": {$in: ['Delivered' , 'Return Rejected']} }},
            {
                $lookup: {
                    from: 'variants',
                    localField: 'orderedItems.variantId',
                    foreignField: '_id',
                    as: 'variantDetails'    
                }
            },
            {$unwind: '$variantDetails'}
        ]

        const stats = await Order.aggregate([
            ...commonPipeline,
            {
             $group: {
                    _id: "$_id",
                    orderSubtotal: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
                    totalItemsInOrder: { $sum: "$orderedItems.quantity" },
                    orderTotalDiscount: {
                        $sum: {
                            $multiply: [
                                {$subtract: ['$variantDetails.regularPrice', '$orderedItems.price']},
                                '$orderedItems.quantity'
                            ]
                        }
                    },
                    couponValue: {$first: '$discount'}
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
                    totalDiscount: { $sum: "$orderTotalDiscount" }
                    
                }
            }
        ])

        const summary = {
         totalOrders: stats[0] ? stats[0].totalOrders : 0,
            totalSales: stats[0] ? stats[0].totalSales : 0,
            totalDiscount: stats[0] ? stats[0].totalDiscount : 0,
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
                   subtotal: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
                   couponValue: { $first: "$discount" },
                   // CORRECTED DISCOUNT PER ROW
                    discount: { 
                        $sum: { 
                            $multiply: [
                                { $subtract: ["$variantDetails.regularPrice", "$orderedItems.price"] }, 
                                "$orderedItems.quantity"
                            ] 
                        } 
                    }
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

                  
                     rowTotal: {
                         $add: [
                             {$subtract: ["$subtotal", '$couponValue'] },
                             "$tax", "$shipping"
                         ]
                        }
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

        const chartResult = await getSalesChartData(reportType);

        return {
            orders,
            summary,
            chartData: chartResult.chartData,
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

export default { getSalesReportService, getSalesChartData };
