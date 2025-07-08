// construction/backend/utils/generatePdf.js
const PDFDocument = require('pdfkit');

const generatePdfReport = async (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50 // Increase margins for more white space
    });
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // --- Define common styles ---
    const primaryColor = '#2C3E50'; // Darker color for main titles/headers
    const secondaryColor = '#5D6D7E'; // Slightly lighter for subtitles/sub-headers
    const textColor = '#34495E'; // General text color
    const tableHeaderBg = '#ECF0F1'; // Light grey for table headers
    const tableBorderColor = '#BDC3C7'; // Light border color

    // You can embed custom fonts here if needed, for example:
    // doc.registerFont('OpenSans-Regular', 'path/to/OpenSans-Regular.ttf');
    // doc.registerFont('OpenSans-Bold', 'path/to/OpenSans-Bold.ttf');

    // --- Header function to be called on every page ---
    const drawHeader = () => {
      doc.y = doc.page.margins.top - 20; // Position above main content
      doc.x = doc.page.margins.left;
      doc.fontSize(10).fillColor(secondaryColor);
      doc.text('CONTRACTOR MANAGEMENT SYSTEM REPORT', { align: 'right' });
      doc.fontSize(8).text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'right' });
      // Add a line below the header
      doc.strokeColor(tableBorderColor).lineWidth(0.5).moveTo(doc.page.margins.left, doc.y + 15).lineTo(doc.page.width - doc.page.margins.right, doc.y + 15).stroke();
      doc.y = doc.page.margins.top + 20; // Reset Y position for content
    };

    // Add header to the first page and subsequent pages
    drawHeader();
    doc.on('pageAdded', drawHeader);


    // --- Main Report Title (Page 1 Specific) ---
    doc.fontSize(28).font('Helvetica-Bold').fillColor(primaryColor).text('Project Performance Report', {
      align: 'center'
    });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').fillColor(secondaryColor).text(`For Period: ${reportData[0]?.summary?.startDate || 'N/A'} to ${reportData[0]?.summary?.endDate || 'N/A'}`, { align: 'center' });
    doc.moveDown(2); // More space after title

    // Helper function to draw a table
    const drawTable = (headers, data, rowMapper, columnWidths, title) => {
      // Check if there's enough space for the title + headers + at least one row
      const minHeightNeeded = (title ? 12 + 5 : 0) + 20 + 20; // Title height + space + header row + data row
      if (doc.y + minHeightNeeded > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }

      if (title) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor).text(title, { underline: false }); // Remove underline for cleaner look
        doc.moveDown(0.7);
      }

      if (!data || data.length === 0) {
        doc.fontSize(10).fillColor('#777').text('No data available for this section.', { continued: false });
        doc.moveDown(1);
        return;
      }

      const tableTop = doc.y;
      const startX = doc.page.margins.left;
      const endX = doc.page.width - doc.page.margins.right;
      const headerRowHeight = 25; // Increased height for better padding
      const dataRowHeight = 20;

      let currentY = tableTop;

      // Draw Headers Background
      doc.rect(startX, currentY, endX - startX, headerRowHeight).fill(tableHeaderBg);

      // Draw Headers Text
      doc.font('Helvetica-Bold').fontSize(9).fillColor(textColor);
      headers.forEach((header, i) => {
        const xCoordinate = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
        const width = columnWidths[i];
        doc.text(header, xCoordinate + 2, currentY + (headerRowHeight - doc.currentLineHeight()) / 2, { // Center vertically
          width: width - 4, // Reduce width slightly for padding
          align: 'center'
        });
      });

      currentY += headerRowHeight;
      doc.strokeColor(tableBorderColor).lineWidth(0.5).rect(startX, tableTop, endX - startX, headerRowHeight).stroke();


      doc.font('Helvetica').fontSize(8).fillColor(textColor); // Reset font for data rows

      data.forEach((item, rowIndex) => {
        let colX = startX;
        const mappedRow = rowMapper(item);

        mappedRow.forEach((cellText, i) => {
          const cellWidth = columnWidths[i];
          doc.text(String(cellText), colX + 5, currentY + (dataRowHeight - doc.currentLineHeight()) / 2, { // Add padding
            width: cellWidth - 10, // Reduce width for padding
            align: 'left',
            height: dataRowHeight,
            valign: 'center'
          });
          colX += cellWidth;
        });

        doc.strokeColor(tableBorderColor).lineWidth(0.5).rect(startX, currentY, endX - startX, dataRowHeight).stroke();
        currentY += dataRowHeight;

        // Add a new page if content exceeds current page
        if (currentY + dataRowHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          currentY = doc.page.margins.top + 20; // Start below the header
          // Redraw table headers on new page
          doc.rect(startX, currentY, endX - startX, headerRowHeight).fill(tableHeaderBg);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(textColor);
          headers.forEach((header, i) => {
            const xCoordinate = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
            const width = columnWidths[i];
            doc.text(header, xCoordinate + 2, currentY + (headerRowHeight - doc.currentLineHeight()) / 2, {
              width: width - 4,
              align: 'center'
            });
          });
          currentY += headerRowHeight;
          doc.strokeColor(tableBorderColor).lineWidth(0.5).rect(startX, currentY - headerRowHeight, endX - startX, headerRowHeight).stroke();
          doc.font('Helvetica').fontSize(8).fillColor(textColor);
        }
      });
      doc.moveDown(1.5); // More space after each table
      doc.x = doc.page.margins.left; // Reset X position
    };

    reportData.forEach((siteReport, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const siteName = siteReport.siteName || 'N/A Site';
      const siteLocation = siteReport.siteLocation || 'N/A Location';
      const siteStartDate = siteReport.startDate ? new Date(siteReport.startDate).toLocaleDateString() : 'N/A Date';
      // Adjust supervisor display logic to ensure it handles object arrays correctly
      const supervisors = (siteReport.supervisors && Array.isArray(siteReport.supervisors))
        ? siteReport.supervisors.map(s => s.name || s).join(', ') // Assuming 's' might be just name string too
        : 'N/A Supervisors';

      doc.fontSize(18).font('Helvetica-Bold').fillColor(primaryColor).text(`Project: ${siteName}`, {
        underline: false // Remove default underline
      });
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica').fillColor(secondaryColor).text(`Location: ${siteLocation}`);
      doc.fontSize(12).text(`Project Start Date: ${siteStartDate}`);
      doc.fontSize(12).text(`Supervisors: ${supervisors}`);
      doc.fontSize(12).text(`Total Workers Assigned: ${siteReport.totalWorkersAssigned}`);
      doc.moveDown(1.5);

      // --- Overall Site Summary ---
      doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor).text('Overall Site Summary:', {
        underline: false
      });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor(textColor).text(`Total Material Cost for Period: ₹${(siteReport.summary && typeof siteReport.summary.totalMaterialCost === 'number' ? siteReport.summary.totalMaterialCost : 0).toFixed(2)}`);
      doc.fontSize(10).text(`Total Advance Given for Period: ₹${(siteReport.summary && typeof siteReport.summary.totalAdvanceGiven === 'number' ? siteReport.summary.totalAdvanceGiven : 0).toFixed(2)}`);
      doc.moveDown(1.5);


      // --- Worker Salary Calculations Table ---
      const salaryHeaders = ['Worker', 'Role', 'RFID', 'Att. Days', 'Daily Rate', 'Gross', 'Advance', 'Net'];
      // Adjust column widths based on new margins and desired spacing
      const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const salaryColumnWidths = [
          availableWidth * 0.18, // Worker Name
          availableWidth * 0.12, // Role
          availableWidth * 0.12, // RFID
          availableWidth * 0.1,  // Att. Days
          availableWidth * 0.12, // Daily Rate
          availableWidth * 0.12, // Gross
          availableWidth * 0.12, // Advance
          availableWidth * 0.12  // Net
      ];

      drawTable(salaryHeaders, siteReport.salaryCalculations, (sal) => [
        sal.workerName || 'N/A',
        sal.workerRole || 'N/A',
        sal.rfidId || 'N/A',
        (typeof sal.totalAttendanceDays === 'number' ? sal.totalAttendanceDays.toFixed(1) : '0.0'),
        (typeof sal.dailyRateUsed === 'number' ? `₹${sal.dailyRateUsed.toFixed(2)}` : '₹0.00'),
        (typeof sal.grossSalary === 'number' ? `₹${sal.grossSalary.toFixed(2)}` : '₹0.00'),
        (typeof sal.totalAdvance === 'number' ? `₹${sal.totalAdvance.toFixed(2)}` : '₹0.00'),
        (typeof sal.netSalary === 'number' ? `₹${sal.netSalary.toFixed(2)}` : '₹0.00'),
      ], salaryColumnWidths, 'Worker Salary Calculations');


      // --- Material Logs Table ---
      const materialHeaders = ['Date', 'Material', 'Brand', 'Qty', 'Unit', 'Price/Unit', 'Total Cost', 'Recorded By'];
      const materialColumnWidths = [
          availableWidth * 0.12, // Date
          availableWidth * 0.18, // Material
          availableWidth * 0.12, // Brand
          availableWidth * 0.08, // Qty
          availableWidth * 0.08, // Unit
          availableWidth * 0.12, // Price/Unit
          availableWidth * 0.12, // Total Cost
          availableWidth * 0.18  // Recorded By
      ];
      drawTable(materialHeaders, siteReport.materialSummary, (m) => [
        m.date ? new Date(m.date).toLocaleDateString() : 'N/A Date',
        m.material || 'N/A',
        m.brand || 'N/A',
        m.quantity || 'N/A',
        m.unit || 'N/A',
// In generatePdf.js within the materialSummary rowMapper:
(typeof m.pricePerUnit === 'number' ? `₹${parseFloat(m.pricePerUnit).toFixed(2)}` : '₹0.00'),
(typeof m.totalCost === 'number' ? `₹${parseFloat(m.totalCost).toFixed(2)}` : '₹0.00'),
        m.recordedBy?.name || 'N/A',
      ], materialColumnWidths, 'Material Logs');


      // --- Activity Logs Table ---
      const activityHeaders = ['Date', 'Message', 'Supervisor'];
      const activityColumnWidths = [
          availableWidth * 0.15, // Date
          availableWidth * 0.60, // Message
          availableWidth * 0.25  // Supervisor
      ];
      drawTable(activityHeaders, siteReport.activityLogs, (a) => [
        a.date ? new Date(a.date).toLocaleDateString() : 'N/A Date',
        a.message || 'N/A',
        a.supervisorId?.name || 'N/A',
      ], activityColumnWidths, 'Daily Activity Logs');


      // --- Advance Payment Logs Table ---
      const advanceHeaders = ['Date', 'Worker Name', 'Amount', 'Reason', 'Recorded By'];
      const advanceColumnWidths = [
          availableWidth * 0.12, // Date
          availableWidth * 0.20, // Worker Name
          availableWidth * 0.10, // Amount
          availableWidth * 0.38, // Reason
          availableWidth * 0.20  // Recorded By
      ];
      drawTable(advanceHeaders, siteReport.advanceLogs, (adv) => [
        adv.date ? new Date(adv.date).toLocaleDateString() : 'N/A Date',
        adv.workerId?.name || 'N/A Worker',
        (typeof adv.amount === 'number' ? `₹${adv.amount.toFixed(2)}` : '₹0.00'),
        adv.reason || 'No reason provided',
        adv.recordedBy?.name || 'N/A',
      ], advanceColumnWidths, 'Advance Payment Logs');

      doc.moveDown(2); // Extra space at the end of each site section
    });

    doc.end();
  });
};

module.exports = {
  generatePdfReport
};