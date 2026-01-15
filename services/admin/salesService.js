import mongoose from "mongoose";
import Order from "../../model/orderModel.js";
import User from "../../model/userModel.js";

const calculateDateRange = (reportType, startDate, endDate) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  end.setHours(23, 59, 59, 999);

  if (reportType === "daily") {
    start.setHours(0, 0, 0, 0);
  } else if (reportType === "weekly") {
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...

    // Calculate days to subtract to get to the previous Monday
    // If Sunday (0), subtract 6. If Monday (1), subtract 0.
    const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    start.setDate(now.getDate() - distanceToMonday);
    start.setHours(0, 0, 0, 0);

    // Optional: If you want the "End Date" to be this coming Sunday (instead of today)
    const endOfSun = new Date(start);
    endOfSun.setDate(start.getDate() + 6);
    endOfSun.setHours(23, 59, 59, 999);
    end = endOfSun;
  } else if (reportType === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (reportType === "yearly") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else if (reportType === "custom" && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
};

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
      return istDate.toISOString().split("T")[0];
    };

    let start = new Date();
    let end = new Date();
    let dateFormat = "%Y-%m-%d"; // Default: Daily

    const nowIST = getISTTime();

    if (reportType === "yearly") {
      const currentYear = nowIST.getUTCFullYear();
      start = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0)); // Jan 1st 00:00 UTC (Adjusted via offset later if needed, but for yearly match it's okay)
      start = new Date(start.getTime() - IST_OFFSET); // Shift back so 00:00 IST matches DB

      end = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
      end = new Date(end.getTime() - IST_OFFSET);

      dateFormat = "%Y-%m";
    } else if (reportType === "monthly") {
      const year = nowIST.getUTCFullYear();
      const month = nowIST.getUTCMonth();

      // Start of Month (IST)
      start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      start = new Date(start.getTime() - IST_OFFSET); // Adjust to 00:00 IST

      // End of Month (IST)
      end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      end = new Date(end.getTime() - IST_OFFSET);

      dateFormat = "%Y-%m-%d";
    } else if (reportType === "weekly") {
      // 1. Get current day (0=Sun, 1=Mon, ..., 6=Sat)
      const dayOfWeek = now.getDay();

      // 2. Calculate offset to get to the previous Monday
      // If today is Sunday (0), subtract 6 days. Otherwise, subtract (day - 1).
      const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      // 3. Set Start Date (Monday 00:00:00)
      start.setDate(now.getDate() - distanceToMonday);
      start.setHours(0, 0, 0, 0);

      // 4. Set End Date (Sunday 23:59:59)
      // We clone the 'start' date and add 6 days to it
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (reportType === "daily") {
      // Start of Today (IST aligned)
      const todayIST = new Date(nowIST);
      todayIST.setUTCHours(0, 0, 0, 0);

      start = new Date(todayIST.getTime() - IST_OFFSET);
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

      dateFormat = "%H:00";
    } else {
      // Default
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const chartData = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },

      { $unwind: "$orderedItems" },

      {
        $match: {
          "orderedItems.productStatus": {
            $in: ["Delivered", "Return Rejected"],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          orderDate: { $first: "$createdAt" },

          orderSubtotal: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"],
            },
          },

          couponDiscount: { $first: { $ifNull: ["$discount", 0] } },
        },
      },

      {
        $addFields: {
          taxAmount: { $multiply: ["$orderSubtotal", 0.05] }, // 5% Tax
          shippingFee: {
            $cond: {
              if: { $lt: ["$orderSubtotal", 100000] },
              then: 100,
              else: 0,
            },
          },
        },
      },

      {
        $addFields: {
          finalOrderRevenue: {
            $subtract: [
              { $add: ["$orderSubtotal", "$taxAmount", "$shippingFee"] },
              "$couponDiscount",
            ],
          },
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: "$orderDate",
              timezone: MY_TIMEZONE,
            },
          },
          totalSales: { $sum: "$finalOrderRevenue" },
          count: { $sum: 1 },
        },
      },

      { $sort: { _id: 1 } },
    ]);

    const filledData = [];
    const dataMap = new Map(chartData.map((item) => [item._id, item]));

    if (reportType === "yearly") {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < 12; i++) {
        const monthKey = `${currentYear}-${(i + 1)
          .toString()
          .padStart(2, "0")}`;
        const data = dataMap.get(monthKey);

        filledData.push({
          _id: months[i],
          totalSales: data ? data.totalSales : 0,
          count: data ? data.count : 0,
        });
      }
    } else if (reportType === "monthly") {
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;

      for (let i = 1; i <= daysInMonth; i++) {
        const dayKey = `${currentYearMonth}-${i.toString().padStart(2, "0")}`;
        const data = dataMap.get(dayKey);

        filledData.push({
          _id: i.toString(),
          totalSales: data ? data.totalSales : 0,
          count: data ? data.count : 0,
        });
      }
    } else if (reportType === "weekly") {
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      for (let i = 0; i < 7; i++) {
        const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);

        const dateKey = getISTDateString(date);

        const istDateObj = new Date(date.getTime() + IST_OFFSET);
        const dayName = days[istDateObj.getUTCDay()];

        const data = dataMap.get(dateKey);

        filledData.push({
          _id: dayName,
          totalSales: data ? data.totalSales : 0,
          count: data ? data.count : 0,
        });
      }
    } else if (reportType === "daily") {
      for (let i = 0; i < 24; i++) {
        const hourKey = i.toString().padStart(2, "0") + ":00";
        const data = dataMap.get(hourKey);

        let label =
          i === 0
            ? "12 AM"
            : i < 12
            ? `${i} AM`
            : i === 12
            ? "12 PM"
            : `${i - 12} PM`;

        filledData.push({
          _id: label,
          totalSales: data ? data.totalSales : 0,
          count: data ? data.count : 0,
        });
      }
    }

    return { chartData: filledData };
  } catch (error) {
    throw new Error(error.message);
  }
};

const getSalesReportService = async ({
  reportType,
  startDate,
  endDate,
  page = 1,
  limit = 10,
}) => {
  try {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (reportType === "daily") {
      start.setHours(0, 0, 0, 0);
    } else if (reportType === "weekly") {
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...

      // Calculate days to subtract to get to the previous Monday
      // If Sunday (0), subtract 6. If Monday (1), subtract 0.
      const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      start.setDate(now.getDate() - distanceToMonday);
      start.setHours(0, 0, 0, 0);

      // Optional: If you want the "End Date" to be this coming Sunday (instead of today)
      const endOfSun = new Date(start);
      endOfSun.setDate(start.getDate() + 6);
      endOfSun.setHours(23, 59, 59, 999);
      end = endOfSun;
    } else if (reportType === "monthly") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (reportType === "yearly") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    } else if (reportType === "custom" && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (start >= end) {
        throw new Error("End date must be after the start date");
      }
      end.setHours(23, 59, 59, 999);
    }

    const totalOrderCountResult = await Order.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    const commonPipeline = [
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: "$orderedItems" },
      {
        $match: {
          "orderedItems.productStatus": {
            $in: ["Delivered", "Return Rejected"],
          },
        },
      },
      {
        $lookup: {
          from: "variants",
          localField: "orderedItems.variantId",
          foreignField: "_id",
          as: "variantDetails",
        },
      },
      { $unwind: "$variantDetails" },
    ];

    const stats = await Order.aggregate([
      ...commonPipeline,
      {
        $group: {
          _id: "$_id",
          orderSubtotal: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"],
            },
          },
          totalItemsInOrder: { $sum: "$orderedItems.quantity" },
          orderTotalDiscount: {
            $sum: {
              $multiply: [
                {
                  $subtract: [
                    "$variantDetails.regularPrice",
                    "$orderedItems.price",
                  ],
                },
                "$orderedItems.quantity",
              ],
            },
          },
          couponValue: { $first: "$discount" },
        },
      },
      {
        $addFields: {
          taxAmount: { $multiply: ["$orderSubtotal", 0.05] },

          shippingFee: {
            $cond: {
              if: { $lt: ["$orderSubtotal", 100000] },
              then: 100,
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          finalOrderRevenue: {
            $add: ["$orderSubtotal", "$taxAmount", "$shippingFee"],
          },
        },
      },

      {
        $group: {
          _id: null,
          totalSales: { $sum: "$finalOrderRevenue" },
          totalItemsSold: { $sum: "$totalItemsInOrder" },
          totalDiscount: { $sum: "$orderTotalDiscount" },
        },
      },
    ]);

    const summary = {
      totalOrders: totalOrderCountResult,
      totalSales: stats[0] ? stats[0].totalSales : 0,
      totalDiscount: stats[0] ? stats[0].totalDiscount : 0,
      totalItems: stats[0] ? stats[0].totalItemsSold : 0,
    };

    const skip = (page - 1) * limit;

    const tableData = await Order.aggregate([
      ...commonPipeline,
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: "$_id",
          orderId: { $first: "$orderId" },
          date: { $first: "$createdAt" },
          customerName: { $first: "$address.fullName" },
          customerEmail: { $first: "$userDetails.email" },
          paymentMethod: { $first: "$paymentMethod" },

          deliveredItems: { $push: "$orderedItems" },

          subtotal: {
            $sum: {
              $multiply: ["$orderedItems.price", "$orderedItems.quantity"],
            },
          },
          couponValue: { $first: "$discount" },

          discount: {
            $sum: {
              $multiply: [
                {
                  $subtract: [
                    "$variantDetails.regularPrice",
                    "$orderedItems.price",
                  ],
                },
                "$orderedItems.quantity",
              ],
            },
          },
        },
      },
      {
        $addFields: {
          tax: { $multiply: ["$subtotal", 0.05] }, // 5% Tax
          shipping: {
            $cond: { if: { $lt: ["$subtotal", 100000] }, then: 100, else: 0 },
          },
        },
      },
      {
        $addFields: {
          rowTotal: {
            $add: [
              { $subtract: ["$subtotal", "$couponValue"] },
              "$tax",
              "$shipping",
            ],
          },
        },
      },
      { $sort: { date: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const orders = tableData[0].data;
    const totalCount = tableData[0].metadata[0]
      ? tableData[0].metadata[0].total
      : 0;
    const totalPages = Math.ceil(totalCount / limit);

    summary.totalOrders = totalOrderCountResult;

    const chartResult = await getSalesChartData(reportType);

    return {
      orders,
      summary,
      chartData: chartResult.chartData,
      totalPages,
      currentPage: parseInt(page),
      dateRange: {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      },
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

const getBestSellingProducts = async ({ reportType, startDate, endDate }) => {
  const { start, end } = calculateDateRange(reportType, startDate, endDate);

  return await Order.aggregate([
    // Filter by Date FIRST (Optimization)
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $unwind: "$orderedItems" },
    {
      $match: {
        "orderedItems.productStatus": { $in: ["Delivered", "Return Rejected"] },
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "orderedItems.variantId",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: "$variant" },
    {
      $group: {
        _id: "$orderedItems.productName",
        totalSold: { $sum: "$orderedItems.quantity" },
        totalRevenue: {
          $sum: {
            $multiply: ["$orderedItems.price", "$orderedItems.quantity"],
          },
        },
        productImage: { $first: "$variant.image" },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);
};

const getBestSellingCategory = async ({ reportType, startDate, endDate }) => {
  const { start, end } = calculateDateRange(reportType, startDate, endDate);

  return await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $unwind: "$orderedItems" },
    {
      $match: {
        "orderedItems.productStatus": { $in: ["Delivered", "Return Rejected"] },
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "orderedItems.variantId",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: "$variant" },
    {
      $lookup: {
        from: "products",
        localField: "variant.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    { $unwind: "$categoryDetails" },
    {
      $group: {
        _id: "$categoryDetails.categoryName",
        totalSold: { $sum: "$orderedItems.quantity" },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);
};
const getBestSellingBrand = async ({ reportType, startDate, endDate }) => {
  const { start, end } = calculateDateRange(reportType, startDate, endDate);

  return await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $unwind: "$orderedItems" },
    {
      $match: {
        "orderedItems.productStatus": { $in: ["Delivered", "Return Rejected"] },
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "orderedItems.variantId",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: "$variant" },
    {
      $lookup: {
        from: "products",
        localField: "variant.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "brands",
        localField: "product.brand",
        foreignField: "_id",
        as: "brandDetails",
      },
    },
    { $unwind: "$brandDetails" },
    {
      $group: {
        _id: "$brandDetails.brandName",
        totalSold: { $sum: "$orderedItems.quantity" },
        brandImage: {
          $first: { $arrayElemAt: ["$brandDetails.brandImage", 0] },
        },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);
};

const getOrderStatus = async ({ reportType, startDate, endDate }) => {
  const { start, end } = calculateDateRange(reportType, startDate, endDate);
  return await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};
const activeUsersCount = async () => {
  const count = await User.countDocuments({ isActive: true });

  return count;
};

export default {
  getSalesReportService,
  getSalesChartData,
  getBestSellingBrand,
  getBestSellingCategory,
  getBestSellingProducts,
  getOrderStatus,
  activeUsersCount,
};
