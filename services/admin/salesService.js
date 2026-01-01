import mongoose  from "mongoose";
import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";

// 2. NEW FUNCTION: ONLY FOR CHART

const getSalesChartData = async (reportType) => {
    try {
        const now = new Date();

        // 1. CONFIGURATION
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 Hours 30 Mins in Milliseconds
        const MY_TIMEZONE = "+05:30"; 

       const getISTTime = () => new Date(new Date().getTime() + IST_OFFSET);

       const getISTDateString = (dateObj) => {
            const istDate = new Date(dateObj.getTime() + IST_OFFSET);
            return istDate.toISOString().split('T')[0];
        };

        let start = new Date();
        let end = new Date();
        let dateFormat = "%Y-%m-%d"; // Default: Daily

        const nowIST = getISTTime();

      if (reportType === 'yearly') {
            const currentYear = nowIST.getUTCFullYear();
            start = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0)); // Jan 1st 00:00 UTC (Adjusted via offset later if needed, but for yearly match it's okay)
            start = new Date(start.getTime() - IST_OFFSET); // Shift back so 00:00 IST matches DB

            end = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
            end = new Date(end.getTime() - IST_OFFSET);
            
            dateFormat = "%Y-%m"; 

        } else if (reportType === 'monthly') {
            const year = nowIST.getUTCFullYear();
            const month = nowIST.getUTCMonth();
            
            // Start of Month (IST)
            start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
            start = new Date(start.getTime() - IST_OFFSET); // Adjust to 00:00 IST

            // End of Month (IST)
            end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            end = new Date(end.getTime() - IST_OFFSET);
            
            dateFormat = "%Y-%m-%d";

        } else if (reportType === 'weekly') {
            const currentDayIST = nowIST.getUTCDay(); // 0 (Sun) to 6 (Sat)
            
            // Calculate difference to get to Monday
            // If Sunday (0), diff is -6. If Monday (1), diff is 0. 
            const diff = currentDayIST === 0 ? -6 : 1 - currentDayIST;

            // Set Start to Monday 00:00:00 IST
            const mondayIST = new Date(nowIST);
            mondayIST.setUTCDate(nowIST.getUTCDate() + diff);
            mondayIST.setUTCHours(0, 0, 0, 0); 
            
            // Adjust server object to match 00:00 IST (which is previous day 18:30 UTC)
            start = new Date(mondayIST.getTime() - IST_OFFSET);

            // End is 6 days later at 23:59:59 IST
            end = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000) - 1);
            
            dateFormat = "%Y-%m-%d";

        } else if (reportType === 'daily') {
            // Start of Today (IST aligned)
           const todayIST = new Date(nowIST);
            todayIST.setUTCHours(0,0,0,0);
            
            start = new Date(todayIST.getTime() - IST_OFFSET);
            end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);
            
            dateFormat = "%H:00";
        } else {
            // Default
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

     

        const filledData = [];
        const dataMap = new Map(chartData.map(item => [item._id, item]));

        if (reportType === 'yearly') {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const currentYear = new Date().getFullYear();
            
            for (let i = 0; i < 12; i++) {
                // Key format matches %Y-%m (e.g., "2025-01")
                const monthKey = `${currentYear}-${(i + 1).toString().padStart(2, '0')}`;
                const data = dataMap.get(monthKey);
                
                filledData.push({
                    _id: months[i], // Label: "Jan", "Feb"...
                    totalSales: data ? data.totalSales : 0,
                    count: data ? data.count : 0
                });
            }

        } else if (reportType === 'monthly') {
            // Get days in current month
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

            for (let i = 1; i <= daysInMonth; i++) {
                // Key format matches %Y-%m-%d (e.g., "2025-12-05")
                const dayKey = `${currentYearMonth}-${i.toString().padStart(2, '0')}`;
                const data = dataMap.get(dayKey);

                filledData.push({
                    _id: i.toString(), // Label: "1", "2", "3"...
                    totalSales: data ? data.totalSales : 0,
                    count: data ? data.count : 0
                });
            }

        } else if (reportType === 'weekly') {
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            
            // Iterate through the generated start-to-end range (7 days)
           for (let i = 0; i < 7; i++) {
                // 1. Create a date object for the specific day in the loop
                const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
                
                // 2. Generate Key: MUST use getISTDateString helper
                // This converts the Date object (which is in server time) to IST string "YYYY-MM-DD"
                // matching what Mongo $dateToString with timezone: "+05:30" produced.
                const dateKey = getISTDateString(date); 
                
                // 3. Get label logic
                // We shift time to IST to find out what day of the week it is in India
                const istDateObj = new Date(date.getTime() + IST_OFFSET);
                const dayName = days[istDateObj.getUTCDay()];

                const data = dataMap.get(dateKey);

                filledData.push({
                    _id: dayName,
                    totalSales: data ? data.totalSales : 0,
                    count: data ? data.count : 0
                });
            }
        } else if (reportType === 'daily') {
            for (let i = 0; i < 24; i++) {
                const hourKey = i.toString().padStart(2, '0') + ":00"; // "09:00"
                const data = dataMap.get(hourKey);
                
                // Readable Label: 1 AM, 2 PM...
                let label = i === 0 ? "12 AM" : (i < 12 ? `${i} AM` : (i === 12 ? "12 PM" : `${i-12} PM`));

                filledData.push({
                    _id: label,
                    totalSales: data ? data.totalSales : 0,
                    count: data ? data.count : 0
                });
            }
        } 

        return { chartData: filledData };

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

const getBestSellingProducts = async () => {
    return await Order.aggregate([
        {$unwind: "$orderedItems"},
        {$match: {"orderedItems.productStatus": {$in: ["Delivered", "Return Rejected"]}}},
      //  Lookup Variant (to get the Product ID)
        {
            $lookup: {
                from: "variants",
                localField: "orderedItems.variantId",
                foreignField: "_id",
                as: "variant"
            }
        },
        { $unwind: "$variant" },
        {
            $group: {
                _id: "$orderedItems.productName",
                totalSold: { $sum: "$orderedItems.quantity" },
                totalRevenue: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },

                productImage: { $first: "$variant.image"}
            }
        },
        {$sort: {totalSold: -1}},
        {$limit: 10}
    ])
}

const getBestSellingCategory = async () => {
    return await Order.aggregate([
        {$unwind: "$orderedItems"},
        {$match: {"orderedItems.productStatus": {$in: ['Delivered', 'Return Rejected']}}},
        {
            $lookup: {
                from: 'variants',
                localField: 'orderedItems.variantId',
                foreignField: '_id',
                as: 'variant'
            }
        },
        {$unwind: '$variant'},
        {
            $lookup: {
                from: 'products',
                localField: 'variant.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {$unwind: '$product'},
        {
            $lookup: {
                from: 'categories',
                localField: 'product.category',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        {$unwind: '$categoryDetails'},
        {
            $group: {
                _id: "$categoryDetails.categoryName",
                totalSold: {$sum: "$orderedItems.quantity"}
            }
        },
        {$sort: {totalSold: -1}},
        {$limit: 10}
    ])
}

const getBestSellingBrand = async () => {
    return await Order.aggregate([
        {$unwind: "$orderedItems"},
        {$match: {"orderedItems.productStatus": {$in: ['Delivered', 'Return Rejected']}}},
       {
         $lookup: {
            from: 'variants',
            localField: 'orderedItems.variantId',
            foreignField: '_id',
            as: 'variant'
         }
       },
       {$unwind: '$variant'},
       {
         $lookup: {
            from: 'products',
            localField: 'variant.productId',
            foreignField: '_id',
            as: 'product'
         }
       },
       {$unwind: '$product'},
       {
        $lookup: {
            from: 'brands',
            localField: 'product.brand',
            foreignField: '_id',
            as: 'brandDetails'
        }
       },
       {$unwind: "$brandDetails"},
       {
        $group: {
            _id: '$brandDetails.brandName',
            totalSold: {$sum: '$orderedItems.quantity'},
            brandImage: {$first: {$arrayElemAt: ['$brandDetails.brandImage', 0]}}
        }
       },
       {$sort: {totalSold: -1}},
       {$limit: 10}
    ])
}

const getOrderStatus = async () => {
    return await Order.aggregate([
        {
            $group: {
                _id: "$status",
                count: {$sum: 1}
            }
        }
    ])
}
const activeUsersCount = async () => {
  const count = await User.countDocuments({isActive: true});

  return count
}

export default { getSalesReportService, getSalesChartData, getBestSellingBrand, getBestSellingCategory, getBestSellingProducts, getOrderStatus, activeUsersCount };
