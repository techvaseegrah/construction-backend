// construction/backend/utils/generatePdf.js
const PDFDocument = require('pdfkit');

const generatePdfReport = async (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 30
    });
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Header for the entire report
    doc.fontSize(20).text('Contractor Management System Report', {
      align: 'center'
    });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'center' });
    doc.moveDown(1.5);

    reportData.forEach((siteReport, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const siteName = siteReport.siteName || 'N/A Site';
      const siteLocation = siteReport.siteLocation || 'N/A Location';
      const siteStartDate = siteReport.startDate ? new Date(siteReport.startDate).toLocaleDateString() : 'N/A Date';
      const supervisors = (siteReport.supervisors && Array.isArray(siteReport.supervisors)) ? siteReport.supervisors.join(', ') : 'N/A Supervisors';

      doc.fontSize(16).fillColor('#333').text(`Project: ${siteName} (${siteLocation})`, {
        underline: true
      });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#555').text(`Supervisors: ${supervisors}`);
      doc.fontSize(10).fillColor('#555').text(`Project Start Date: ${siteStartDate}`);
      doc.fontSize(10).fillColor('#555').text(`Total Workers Assigned: ${siteReport.totalWorkersAssigned}`);
      doc.moveDown(1);

      // --- Overall Site Summary ---
      doc.fontSize(12).fillColor('#333').text('Overall Site Summary:', {
        underline: true
      });
      doc.fontSize(10).text(`Total Material Cost for Period: ₹${(siteReport.summary && typeof siteReport.summary.totalMaterialCost === 'number' ? siteReport.summary.totalMaterialCost : 0).toFixed(2)}`);
      doc.fontSize(10).text(`Total Advance Given for Period: ₹${(siteReport.summary && typeof siteReport.summary.totalAdvanceGiven === 'number' ? siteReport.summary.totalAdvanceGiven : 0).toFixed(2)}`);
      doc.moveDown(1);


      // Helper function to draw a table
      const drawTable = (headers, data, rowMapper, columnWidths, title) => {
        if (title) {
          doc.fontSize(12).fillColor('#333').text(title, { underline: true });
          doc.moveDown(0.5);
        }

        if (!data || data.length === 0) {
          doc.fontSize(10).fillColor('#777').text('No data available for this section.', doc.x, doc.y + 5);
          doc.moveDown(1);
          return;
        }

        const tableTop = doc.y + 10;
        const startX = doc.page.margins.left;
        const endX = doc.page.width - doc.page.margins.right;
        const rowHeight = 20;

        let currentY = tableTop;

        // Draw Headers
        doc.font('Helvetica-Bold').fontSize(9);
        headers.forEach((header, i) => {
          const xCoordinate = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
          const width = columnWidths[i];

          doc.text(header, xCoordinate, currentY, {
            width: width,
            align: 'center'
          });
        });

        currentY += rowHeight;
        doc.rect(startX, tableTop, endX - startX, rowHeight).stroke();


        doc.font('Helvetica').fontSize(8);

        data.forEach((item, rowIndex) => {
          let colX = startX;
          const mappedRow = rowMapper(item);

          mappedRow.forEach((cellText, i) => {
            const cellWidth = columnWidths[i] - 4;

            doc.text(String(cellText), colX + 2, currentY + 5, {
              width: cellWidth,
              align: 'left',
              height: rowHeight,
              valign: 'center'
            });
            colX += columnWidths[i];
          });
          doc.rect(startX, currentY, endX - startX, rowHeight).stroke();
          currentY += rowHeight;

          if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
              doc.addPage();
              currentY = doc.page.margins.top + 30;
              doc.x = doc.page.margins.left;
              doc.font('Helvetica-Bold').fontSize(9);
              headers.forEach((header, i) => {
                doc.text(header, doc.x + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, {
                  width: columnWidths[i],
                  align: 'center'
                });
              });
              currentY += rowHeight;
              doc.rect(startX, currentY - rowHeight, endX - startX, rowHeight).stroke();
              doc.font('Helvetica').fontSize(8);
          }
        });
        doc.moveDown(1);
        doc.y = currentY + 10;
        doc.x = doc.page.margins.left;
      };


      // --- Worker Salary Calculations Table ---
      const salaryHeaders = ['Worker', 'Role', 'RFID', 'Att. Days', 'Daily Rate', 'Gross', 'Advance', 'Net'];
      const salaryColumnWidths = [80, 50, 60, 50, 50, 50, 50, 50];
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
      const materialColumnWidths = [60, 80, 60, 40, 40, 50, 50, 70];
      drawTable(materialHeaders, siteReport.materialSummary, (m) => [
        m.date ? new Date(m.date).toLocaleDateString() : 'N/A Date',
        m.material || 'N/A',
        m.brand || 'N/A',
        m.quantity || 'N/A',
        m.unit || 'N/A',
        (typeof m.pricePerUnit === 'number' ? `₹${m.pricePerUnit.toFixed(2)}` : '₹0.00'),
        (typeof m.totalCost === 'number' ? `₹${m.totalCost.toFixed(2)}` : '₹0.00'),
        m.recordedBy?.name || 'N/A',
      ], materialColumnWidths, 'Material Logs');


      // --- Activity Logs Table ---
      const activityHeaders = ['Date', 'Message', 'Supervisor'];
      const activityColumnWidths = [60, 280, 80];
      drawTable(activityHeaders, siteReport.activityLogs, (a) => [
        a.date ? new Date(a.date).toLocaleDateString() : 'N/A Date',
        a.message || 'N/A',
        a.supervisorId?.name || 'N/A',
      ], activityColumnWidths, 'Daily Activity Logs');


      // --- Advance Payment Logs Table ---
      const advanceHeaders = ['Date', 'Worker Name', 'Amount', 'Reason', 'Recorded By'];
      const advanceColumnWidths = [60, 100, 50, 120, 80];
      drawTable(advanceHeaders, siteReport.advanceLogs, (adv) => [
        adv.date ? new Date(adv.date).toLocaleDateString() : 'N/A Date',
        adv.workerId?.name || 'N/A Worker',
        (typeof adv.amount === 'number' ? `₹${adv.amount.toFixed(2)}` : '₹0.00'),
        adv.reason || 'No reason provided',
        adv.recordedBy?.name || 'N/A',
      ], advanceColumnWidths, 'Advance Payment Logs');


      doc.moveDown(2);
    });

    doc.end();
  });
};

module.exports = {
  generatePdfReport
};