const PDFDocument = require('pdfkit');

const generatePdfReport = async (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    doc.fontSize(24).text('Contractor Management Report', {
      align: 'center'
    });
    doc.moveDown();

    reportData.forEach(siteReport => {
      doc.fontSize(18).text(`Project: ${siteReport.siteName} (${siteReport.siteLocation})`, {
        underline: true
      });
      doc.fontSize(12).text(`Supervisors: ${siteReport.supervisors.join(', ')}`);
      doc.fontSize(12).text(`Start Date: ${new Date(siteReport.startDate).toLocaleDateString()}`);
      doc.moveDown();

      // Summary
      doc.fontSize(14).text('Summary:', {
        underline: true
      });
      doc.fontSize(12).text(`Total Material Cost: $${siteReport.summary.totalMaterialCost.toFixed(2)}`);
      doc.fontSize(12).text(`Total Advance Given: $${siteReport.summary.totalAdvanceGiven.toFixed(2)}`);
      doc.moveDown();

      // Worker Salaries
      doc.fontSize(14).text('Worker Salaries:', {
        underline: true
      });
      if (siteReport.workers.length > 0) {
        siteReport.workers.forEach(worker => {
          doc.fontSize(12).text(`- ${worker.workerName} (${worker.workerRole})`);
          doc.fontSize(10).text(`  Daily Rate: $${worker.dailyRate.toFixed(2)}`);
          doc.fontSize(10).text(`  Total Attendance Days: ${worker.totalAttendanceDays}`);
          doc.fontSize(10).text(`  Gross Salary: $${worker.grossSalary.toFixed(2)}`);
          doc.fontSize(10).text(`  Advance Deducted: $${worker.totalAdvanceDeducted.toFixed(2)}`);
          doc.fontSize(10).text(`  Net Salary: $${worker.netSalary.toFixed(2)}`);
          doc.moveDown(0.5);
        });
      } else {
        doc.fontSize(12).text('No worker salary data for this period.');
      }
      doc.moveDown();

      // Material Logs
      doc.fontSize(14).text('Material Logs:', {
        underline: true
      });
      if (siteReport.materials.length > 0) {
        siteReport.materials.forEach(material => {
          doc.fontSize(10).text(`- ${new Date(material.date).toLocaleDateString()}: ${material.material} (${material.brand || 'N/A'}) - ${material.quantity} ${material.unit} @ $${material.pricePerUnit}/unit = $${material.total.toFixed(2)} (Logged by: ${material.recordedBy ? material.recordedBy.name : 'N/A'})`);
        });
      } else {
        doc.fontSize(12).text('No material logs for this period.');
      }
      doc.moveDown();

      // Activity Logs
      doc.fontSize(14).text('Activity Logs:', {
        underline: true
      });
      if (siteReport.activities.length > 0) {
        siteReport.activities.forEach(activity => {
          doc.fontSize(10).text(`- ${new Date(activity.date).toLocaleDateString()} (${activity.supervisorId ? activity.supervisorId.name : 'N/A'}): ${activity.message}`);
        });
      } else {
        doc.fontSize(12).text('No activity logs for this period.');
      }
      doc.moveDown();

      // Salary Logs (previously calculated weekly salaries)
      doc.fontSize(14).text('Weekly Salary Payouts:', {
        underline: true
      });
      if (siteReport.salaryLogs.length > 0) {
        siteReport.salaryLogs.forEach(salaryLog => {
          doc.fontSize(10).text(`- Worker: ${salaryLog.workerId ? salaryLog.workerId.name : 'N/A'} (${salaryLog.workerId ? salaryLog.workerId.role : 'N/A'})`);
          doc.fontSize(10).text(`  Week: ${new Date(salaryLog.weekStart).toLocaleDateString()} - ${new Date(salaryLog.weekEnd).toLocaleDateString()}`);
          doc.fontSize(10).text(`  Total Attendance Days: ${salaryLog.totalAttendanceDays}`);
          doc.fontSize(10).text(`  Gross: $${salaryLog.grossSalary.toFixed(2)}, Advance Deducted: $${salaryLog.totalAdvanceDeducted.toFixed(2)}, Net: $${salaryLog.netSalary.toFixed(2)}`);
          doc.fontSize(10).text(`  Paid: ${salaryLog.paid ? 'Yes' : 'No'} ${salaryLog.paymentDate ? `(${new Date(salaryLog.paymentDate).toLocaleDateString()})` : ''}`);
          doc.moveDown(0.3);
        });
      } else {
        doc.fontSize(12).text('No weekly salary logs for this period.');
      }
      doc.moveDown();


      // Advance Logs
      doc.fontSize(14).text('Advance Payment Logs:', {
        underline: true
      });
      if (siteReport.advances.length > 0) {
        siteReport.advances.forEach(advance => {
          doc.fontSize(10).text(`- Worker: ${advance.workerId ? advance.workerId.name : 'N/A'}`);
          doc.fontSize(10).text(`  Date: ${new Date(advance.date).toLocaleDateString()}, Amount: $${advance.amount.toFixed(2)}, Reason: ${advance.reason}, By: ${advance.recordedBy ? advance.recordedBy.name : 'N/A'}`);
          doc.moveDown(0.3);
        });
      } else {
        doc.fontSize(12).text('No advance logs for this period.');
      }
      doc.moveDown();

      if (siteReport !== reportData[reportData.length - 1]) {
        doc.addPage();
      }
    });

    doc.end();
  });
};

module.exports = {
  generatePdfReport
};
