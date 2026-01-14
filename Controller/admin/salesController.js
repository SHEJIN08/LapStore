import salesReportService from "../../services/admin/salesService.js";
import { ResponseMessage, StatusCode } from "../../utils/statusCode.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";


const loadSalesReport = async (req, res) => {
    try {
        const { page = 1, reportType = 'yearly', startDate, endDate } = req.query;

        const data = await salesReportService.getSalesReportService({
            page,
            reportType,
            startDate,
            endDate
        });
        
        res.render("admin/salesReport", {
            orders: data.orders,
            // Stats
            totalOrders: data.summary.totalOrders,
            totalSales: data.summary.totalSales,
            totalDiscount: data.summary.totalDiscount,
            // Pagination
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            // Filters (Keep them active on reload)
            reportType: reportType,
            startDate: startDate || data.dateRange.start,
            endDate: endDate || data.dateRange.end,
            activePage: 'report'
        });

    } catch (error) {
        console.error("Sales Report Error:", error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: error.message});
    }
};

// --- 2. DOWNLOAD REPORT (PDF & EXCEL) ---
const downloadReport = async (req, res) => {
    try {
        const { format, reportType, startDate, endDate } = req.query;

        // Fetch ALL data (limit: 0 means no limit effectively, or use a large number)
        const data = await salesReportService.getSalesReportService({
            page: 1,
            limit: 1000000, 
            reportType,
            startDate,
            endDate
        });

        const orders = data.orders;
        const summary = data.summary;

        // --- A. PDF GENERATION ---
        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });

            // Set Headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.pdf`);

            doc.pipe(res);

            // Title
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10).text(`Generated Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
            doc.text(`Period: ${reportType.toUpperCase()}`, { align: 'right' });
            doc.moveDown();

            // Summary Box
            doc.rect(30, 100, 535, 70).stroke();
            doc.fontSize(12).text('Summary', 40, 110, { underline: true });
            doc.fontSize(10)
                .text(`Total Orders: ${summary.totalOrders}`, 40, 130)
                .text(`Total Sales: Rs.${summary.totalSales.toLocaleString()}`, 200, 130)
                .text(`Total Discount: Rs.${summary.totalDiscount}`, 380, 130);

            doc.moveDown(5);

            // Table Headers
            const tableTop = 200;
            const itemX = 30;
            const dateX = 220;  
            const amountX = 330;  
            const discountX = 410;
            const paymentX = 490;

            doc.font('Helvetica-Bold').fontSize(10);
            doc.text('Product / Order ID', itemX, tableTop);
            doc.text('Date', dateX, tableTop);
            doc.text('Amount', amountX, tableTop);
            doc.text('Discount', discountX, tableTop); 
            doc.text('Payment', paymentX, tableTop);
            
           doc.moveTo(30, tableTop + 15).lineTo(565, tableTop + 15).stroke();

            // Table Rows
            let y = tableTop + 25;
            doc.font('Helvetica');

            orders.forEach(order => {
                // Check if we need a new page
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }

                // Since we unwinded, each 'order' is actually one item row
                // We show Product Name and Order ID
                const productName = order.deliveredItems && order.deliveredItems[0] 
                    ? order.deliveredItems[0].productName 
                    : 'Unknown Item';

                doc.fontSize(9).text(productName, itemX, y, { width: 200, ellipsis: true });
                doc.fontSize(8).text(`#${order.orderId}`, itemX, y + 12, { color: 'grey' }); // Subtext
                
                doc.fillColor('black').fontSize(9);
                doc.text(new Date(order.date).toLocaleDateString(), dateX, y);
                doc.text(`Rs.${Math.round(order.rowTotal)}`, amountX, y);      
                doc.text(`Rs.${order.discount || 0}`, discountX, y);
                doc.text(order.paymentMethod, paymentX, y);

                y += 30;
                doc.moveTo(30, y - 10).lineTo(565, y - 10).strokeColor('#eeeeee').stroke(); // Light divider
                doc.strokeColor('black'); // Reset color
            });

            doc.end();
        } 
        
        // --- B. EXCEL GENERATION ---
        else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Define Columns
            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 15 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customer', width: 20 },
                { header: 'Product', key: 'product', width: 30 },
                { header: 'Quantity', key: 'qty', width: 10 },
                { header: 'Unit Price', key: 'price', width: 15 },
                { header: 'Total', key: 'total', width: 15 },
                { header: 'Discount', key: 'discount', width: 15 },
                { header: 'Payment', key: 'payment', width: 10 },
            ];

            // Add Rows
            orders.forEach(order => {
                // Since we aggregated, deliveredItems is an array (usually length 1 due to unwind, 
                // but let's be safe and loop if your logic grouped them back)
                order.deliveredItems.forEach(item => {
                    worksheet.addRow({
                        orderId: order.orderId,
                        date: new Date(order.date).toLocaleDateString(),
                        customer: order.customerName,
                        product: item.productName,
                        qty: item.quantity,
                        price: item.price,
                        total: item.price * item.quantity,
                        discount: order.discount || 0,
                        payment: order.paymentMethod
                    });
                });
            });

            // Style Header
            worksheet.getRow(1).font = { bold: true };
            
            // Add Summary Row at bottom
            worksheet.addRow([]);
            worksheet.addRow(['Total Sales:', '', '', '', '', '', `Rs.${summary.totalSales}`]);

            // Set Headers & Send
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        }

    } catch (error) {
        console.error("Download Error:", error);
        res.status(500).send("Error generating download");
    }
};

export default {loadSalesReport, downloadReport}