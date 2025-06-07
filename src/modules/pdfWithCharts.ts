import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { promisify } from 'util';
import { Buffer } from 'buffer';
import * as imageSize from 'image-size';

// Interface for table data
interface TableData {
  headers: string[];
  rows: any[][];
  title?: string;
  widths?: number[];
  columnStyles?: {
    [key: number]: {
      align?: 'left' | 'center' | 'right';
      font?: string;
      fontSize?: number;
      textColor?: string;
    };
  };
}

// Interface for table options
interface TableOptions {
  headerBackgroundColor?: string;
  headerTextColor?: string;
  rowBackgroundColors?: string[];
  borderColor?: string;
  fontSize?: {
    header?: number;
    body?: number;
  };
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  headerFont?: string;
  bodyFont?: string;
  alternateRowColoring?: boolean;
}

// Interface for chart data
interface ChartData {
  type: 'bar' | 'pie';
  title?: string;
  labels: string[];
  data: number[];
  colors?: string[];
  width?: number;
  height?: number;
}

// Interface for PDF options with charts and tables
interface PDFWithChartsOptions extends PDFOptions {
  tableOptions?: TableOptions;
  chartSpacing?: number;
  captionFontSize?: number;
  captionFont?: string;
}

/**
 * Creates a PDF with multiple tables
 * 
 * @param logoUrl URL or path to the company logo
 * @param companyName Name of the company
 * @param tables Array of table data objects
 * @param options PDF options
 * @returns Promise resolving to a Buffer with the PDF data
 */
export async function createMultipleTables(
  logoUrl: string,
  companyName: string,
  tables: TableData[],
  options: PDFWithChartsOptions = {}
): Promise<Buffer> {
  // Merge default options with provided options
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise(async (resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        autoFirstPage: true,
        bufferPages: true,
        compress: true,
        size: 'A4',
        margin: mergedOptions.pageMargin || 50
      });
      
      // Collect the PDF data chunks
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });
      
      doc.on('error', (err) => {
        reject(new Error(`PDF generation error: ${err.message}`));
      });
      
      // Set default font and size
      doc.font(mergedOptions.fontFamily || 'Helvetica')
         .fontSize(mergedOptions.fontSize || 12);
      
      // Add header with logo and company name
      if (logoUrl) {
        try {
          const imageBuffer = await fetchImageBuffer(logoUrl);          
          const dimensions = imageSize.imageSize(imageBuffer);
          
          // Calculate aspect ratio for proper scaling
          const logoWidth = mergedOptions.logoWidth || 100;
          const logoHeight = dimensions.height 
            ? (dimensions.height * logoWidth) / dimensions.width
            : logoWidth;
          
          // Add logo to top left
          doc.image(
            imageBuffer, 
            mergedOptions.pageMargin || 50, 
            mergedOptions.pageMargin || 50, 
            { width: logoWidth }
          );
            
          // Add company name next to logo
          doc.fontSize(mergedOptions.companyNameFontSize || 16)
             .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
             .text(
               companyName, 
               (mergedOptions.pageMargin || 50) + logoWidth + 20, 
               (mergedOptions.pageMargin || 50) + (logoHeight/2) - 10, 
               { align: 'left' }
             );
          
        } catch (logoError) {
          console.warn(`Logo could not be added: ${logoError.message}. Continuing without logo.`);
          
          // Add company name at the top left if logo fails
          doc.fontSize(mergedOptions.companyNameFontSize || 16)
             .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
             .text(
               companyName, 
               mergedOptions.pageMargin || 50, 
               mergedOptions.pageMargin || 50, 
               { align: 'left' }
             );
        }
      } else {
        // No logo, just add company name at the top left
        doc.fontSize(mergedOptions.companyNameFontSize || 16)
           .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
           .text(
             companyName, 
             mergedOptions.pageMargin || 50, 
             mergedOptions.pageMargin || 50, 
             { align: 'left' }
           );
      }
      
      // Move down from the header
      doc.moveDown(3);
      
      // Reset font for content
      doc.font(mergedOptions.fontFamily || 'Helvetica')
         .fontSize(mergedOptions.fontSize || 12);
      
      // Default table options
      const defaultTableOptions: TableOptions = {
        headerBackgroundColor: '#D3D3D3', // Light gray
        headerTextColor: '#000000',
        rowBackgroundColors: ['#FFFFFF', '#F5F5F5'], // White and light gray alternating
        borderColor: '#000000',
        fontSize: {
          header: 12,
          body: 10,
        },
        padding: {
          top: 5,
          right: 8,
          bottom: 5,
          left: 8,
        },
        headerFont: `${mergedOptions.fontFamily || 'Helvetica'}-Bold`,
        bodyFont: mergedOptions.fontFamily || 'Helvetica',
        alternateRowColoring: true,
      };
      
      // Merge default table options with provided options
      const tableOptions = { ...defaultTableOptions, ...options.tableOptions };
      
      // Add each table
      for (const table of tables) {
        // Add table title if provided
        if (table.title) {
          doc.font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
             .fontSize(14)
             .text(table.title, { align: 'center' })
             .moveDown();
        }
        
        // Calculate column widths if not provided
        const columnWidths = table.widths || 
          Array(table.headers.length).fill((doc.page.width - (mergedOptions.pageMargin || 50) * 2) / table.headers.length);
        
        // Current y position
        let startY = doc.y;
        let currentX = mergedOptions.pageMargin || 50;
        
        // Draw table header
        doc.font(tableOptions.headerFont)
           .fontSize(tableOptions.fontSize?.header || 12);
        
        // Draw header background
        doc.fillColor(tableOptions.headerBackgroundColor)
           .rect(
             currentX,
             startY,
             columnWidths.reduce((a, b) => a + b, 0),
             tableOptions.padding?.top + tableOptions.fontSize?.header + tableOptions.padding?.bottom)
           .fill();
        
        // Draw header text
        doc.fillColor(tableOptions.headerTextColor);
        for (let i = 0; i < table.headers.length; i++) {
          const columnStyle = table.columnStyles?.[i] || {};
          const align = columnStyle.align || 'left';
          
          doc.text(
            table.headers[i],
            currentX + (tableOptions.padding?.left || 8),
            startY + (tableOptions.padding?.top || 5),
            {
              width: columnWidths[i] - (tableOptions.padding?.left || 8) - (tableOptions.padding?.right || 8),
              align: align
            }
          );
          
          currentX += columnWidths[i];
        }
        
        // Move to next row
        startY += tableOptions.padding?.top + tableOptions.fontSize?.header + tableOptions.padding?.bottom;
        
        // Draw table rows
        doc.font(tableOptions.bodyFont)
           .fontSize(tableOptions.fontSize?.body || 10);
        
        // For each row
        for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
          // Check if we need to create a new page
          const rowHeight = tableOptions.padding?.top + tableOptions.fontSize?.body + tableOptions.padding?.bottom;
          if (startY + rowHeight > doc.page.height - (mergedOptions.pageMargin || 50) - 60) {
            doc.addPage();
            startY = mergedOptions.pageMargin || 50;
            
            // Add header to new page
            if (logoUrl) {
              try {
                const imageBuffer = await fetchImageBuffer(logoUrl);          
                const dimensions = imageSize.imageSize(imageBuffer);
                
                const logoWidth = mergedOptions.logoWidth || 100;
                const logoHeight = dimensions.height 
                  ? (dimensions.height * logoWidth) / dimensions.width
                  : logoWidth;
                
                doc.image(
                  imageBuffer, 
                  mergedOptions.pageMargin || 50, 
                  mergedOptions.pageMargin || 50, 
                  { width: logoWidth }
                );
                  
                doc.fontSize(mergedOptions.companyNameFontSize || 16)
                   .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
                   .text(
                     companyName, 
                     (mergedOptions.pageMargin || 50) + logoWidth + 20, 
                     (mergedOptions.pageMargin || 50) + (logoHeight/2) - 10, 
                     { align: 'left' }
                   );
              } catch (logoError) {
                console.warn(`Logo could not be added to new page: ${logoError.message}`);
              }
            } else {
              doc.fontSize(mergedOptions.companyNameFontSize || 16)
                 .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
                 .text(
                   companyName, 
                   mergedOptions.pageMargin || 50, 
                   mergedOptions.pageMargin || 50, 
                   { align: 'left' }
                 );
            }
            
            // Move down from header
            doc.moveDown(3);
            startY = doc.y;
            
            // Reset font for table content
            doc.font(tableOptions.bodyFont)
               .fontSize(tableOptions.fontSize?.body || 10);
          }
          
          // Draw row background
          currentX = mergedOptions.pageMargin || 50;
          const row = table.rows[rowIndex];
          
          // Alternate background colors if enabled
          if (tableOptions.alternateRowColoring && tableOptions.rowBackgroundColors) {
            const bgColor = tableOptions.rowBackgroundColors[rowIndex % tableOptions.rowBackgroundColors.length];
            doc.fillColor(bgColor)
               .rect(
                 currentX,
                 startY,
                 columnWidths.reduce((a, b) => a + b, 0),
                 rowHeight
               )
               .fill();
          }
          
          // Draw row text
          doc.fillColor('#000000'); // Reset text color to black
          for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
            const columnStyle = table.columnStyles?.[cellIndex] || {};
            const align = columnStyle.align || 'left';
            const cellFont = columnStyle.font || tableOptions.bodyFont;
            const cellFontSize = columnStyle.fontSize || tableOptions.fontSize?.body || 10;
            const textColor = columnStyle.textColor || '#000000';
            
            // Apply cell-specific styling
            doc.font(cellFont)
               .fontSize(cellFontSize)
               .fillColor(textColor);
            
            doc.text(
              row[cellIndex]?.toString() || '',
              currentX + (tableOptions.padding?.left || 8),
              startY + (tableOptions.padding?.top || 5),
              {
                width: columnWidths[cellIndex] - (tableOptions.padding?.left || 8) - (tableOptions.padding?.right || 8),
                align: align
              }
            );
            
            currentX += columnWidths[cellIndex];
          }
          
          // Draw horizontal line at bottom of row
          doc.strokeColor(tableOptions.borderColor)
             .lineWidth(0.5)
             .moveTo(mergedOptions.pageMargin || 50, startY + rowHeight)
             .lineTo((mergedOptions.pageMargin || 50) + columnWidths.reduce((a, b) => a + b, 0), startY + rowHeight)
             .stroke();
          
          // Move to next row
          startY += rowHeight;
        }
        
        // Move down after table
        doc.moveDown(2);
      }
      
      // Add page numbers to footer
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(10)
           .text(
             `Page ${i + 1} of ${totalPages}`,
             0,
             doc.page.height - (mergedOptions.pageMargin || 50) - 20,
             { align: 'center' }
           );
      }
      
      // Finalize the PDF
      doc.end();
      
    } catch (error) {
      reject(new Error(`Error in PDF creation: ${error.message}`));
    }
  });
}

/**
 * Creates a PDF with multiple tables and charts (bar charts and pie charts)
 * 
 * @param logoUrl URL or path to the company logo
 * @param companyName Name of the company
 * @param tables Array of table data objects
 * @param charts Array of chart data objects
 * @param options PDF options
 * @returns Promise resolving to a Buffer with the PDF data
 */
export async function createPDFWithBarsAndPie(
  logoUrl: string,
  companyName: string,
  tables: TableData[],
  charts: ChartData[],
  options: PDFWithChartsOptions = {}
): Promise<Buffer> {
  // Merge default options with provided options
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise(async (resolve, reject) => {
    try {
      // First, create the PDF with tables
      const chunks: Buffer[] = [];
      
      // Create a new PDF document
      const doc = new PDFDocument({
        autoFirstPage: true,
        bufferPages: true,
        compress: true,
        size: 'A4',
        margin: mergedOptions.pageMargin || 50
      });
      
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });
      
      doc.on('error', (err) => {
        reject(new Error(`PDF generation error: ${err.message}`));
      });
      
      // Set default font and size
      doc.font(mergedOptions.fontFamily || 'Helvetica')
         .fontSize(mergedOptions.fontSize || 12);
      
      // Add header with logo and company name
      if (logoUrl) {
        try {
          const imageBuffer = await fetchImageBuffer(logoUrl);          
          const dimensions = imageSize.imageSize(imageBuffer);
          
          // Calculate aspect ratio for proper scaling
          const logoWidth = mergedOptions.logoWidth || 100;
          const logoHeight = dimensions.height 
            ? (dimensions.height * logoWidth) / dimensions.width
            : logoWidth;
          
          // Add logo to top left
          doc.image(
            imageBuffer, 
            mergedOptions.pageMargin || 50, 
            mergedOptions.pageMargin || 50, 
            { width: logoWidth }
          );
            
          // Add company name next to logo
          doc.fontSize(mergedOptions.companyNameFontSize || 16)
             .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
             .text(
               companyName, 
               (mergedOptions.pageMargin || 50) + logoWidth + 20, 
               (mergedOptions.pageMargin || 50) + (logoHeight/2) - 10, 
               { align: 'left' }
             );
          
        } catch (logoError) {
          console.warn(`Logo could not be added: ${logoError.message}. Continuing without logo.`);
          
          // Add company name at the top left if logo fails
          doc.fontSize(mergedOptions.companyNameFontSize || 16)
             .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
             .text(
               companyName, 
               mergedOptions.pageMargin || 50, 
               mergedOptions.pageMargin || 50, 
               { align: 'left' }
             );
        }
      } else {
        // No logo, just add company name at the top left
        doc.fontSize(mergedOptions.companyNameFontSize || 16)
           .font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
           .text(
             companyName, 
             mergedOptions.pageMargin || 50, 
             mergedOptions.pageMargin || 50, 
             { align: 'left' }
           );
      }
      
      // Move down from the header
      doc.moveDown(3);
      
      // Reset font for content
      doc.font(mergedOptions.fontFamily || 'Helvetica')
         .fontSize(mergedOptions.fontSize || 12);
      
      // Default table options
      const defaultTableOptions: TableOptions = {
        headerBackgroundColor: '#D3D3D3', // Light gray
        headerTextColor: '#000000',
        rowBackgroundColors: ['#FFFFFF', '#F5F5F5'], // White and light gray alternating
        borderColor: '#000000',
        fontSize: {
          header: 12,
          body: 10,
        },
        padding: {
          top: 5,
          right: 8,
          bottom: 5,
          left: 8,
        },
        headerFont: `${mergedOptions.fontFamily || 'Helvetica'}-Bold`,
        bodyFont: mergedOptions.fontFamily || 'Helvetica',
        alternateRowColoring: true,
      };
      
      // Merge default table options with provided options
      const tableOptions = { ...defaultTableOptions, ...options.tableOptions };
      
      // Add tables first
      await addTablesToDocument(doc, tables, mergedOptions, tableOptions, logoUrl, companyName);
      
      // Default chart spacing
      const chartSpacing = mergedOptions.chartSpacing || 20;
      
      // Add charts after tables
      for (let i = 0; i < charts.length; i++) {
        const chart = charts[i];
        
        // Check if we need to create a new page
        const chartWidth = chart.width || 400;
        const chartHeight = chart.height || 300;
        
        if (doc.y + chartHeight + 50 > doc.page.height - (mergedOptions.pageMargin || 50) - 60) {
          doc.addPage();
          
          // Add header to new page
          await addDocumentHeader(doc, logoUrl, companyName, mergedOptions);
        }
        
        // Add chart title if provided
        if (chart.title) {
          doc.font(`${mergedOptions.fontFamily || 'Helvetica'}-Bold`)
             .fontSize(14)
             .text(chart.title, { align: 'center' })
             .moveDown();
        }
        
        // Draw chart
        if (chart.type === 'bar') {
          drawBarChart(doc, chart, mergedOptions);
        } else if (chart.type === 'pie') {
          drawPieChart(doc, chart, mergedOptions);
        }
        
        // Move down after chart
        doc.moveDown(2);
      }
      
      // Add page numbers to footer
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(10)
           .text(
             `Page ${i + 1} of ${totalPages}`,
             0,
             doc.page.height - (mergedOptions.pageMargin || 50) - 20,
             { align: 'center' }
           );
      }
      
      // Finalize the PDF
      doc.end();
      
    } catch (error) {
      reject(new Error(`Error in PDF creation: ${error.message}`));
    }
  });
}

/**
 * Add tables to the PDF document
 */
async function addTablesToDocument(
  doc: PDFKit.PDFDocument, 
  tables: TableData[], 
  options: PDFOptions, 
  tableOptions: TableOptions,
  logoUrl: string,
  companyName: string
): Promise<void> {
  // Add each table
  for (const table of tables) {
    // Add table title if provided
    if (table.title) {
      doc.font(`${options.fontFamily || 'Helvetica'}-Bold`)
         .fontSize(14)
         .text(table.title, { align: 'center' })
         .moveDown();
    }
    
    // Calculate column widths if not provided
    const columnWidths = table.widths || 
      Array(table.headers.length).fill((doc.page.width - (options.pageMargin || 50) * 2) / table.headers.length);
    
    // Current y position
    let startY = doc.y;
    let currentX = options.pageMargin || 50;
    
    // Draw table header
    doc.font(tableOptions.headerFont)
       .fontSize(tableOptions.fontSize?.header || 12);
    
    // Draw header background
    doc.fillColor(tableOptions.headerBackgroundColor)
       .rect(
         currentX,
         startY,
         columnWidths.reduce((a, b) => a + b, 0),
         tableOptions.padding?.top + tableOptions.fontSize?.header + tableOptions.padding?.bottom)
       .fill();
    
    // Draw header text
    doc.fillColor(tableOptions.headerTextColor);
    for (let i = 0; i < table.headers.length; i++) {
      const columnStyle = table.columnStyles?.[i] || {};
      const align = columnStyle.align || 'left';
      
      doc.text(
        table.headers[i],
        currentX + (tableOptions.padding?.left || 8),
        startY + (tableOptions.padding?.top || 5),
        {
          width: columnWidths[i] - (tableOptions.padding?.left || 8) - (tableOptions.padding?.right || 8),
          align: align
        }
      );
      
      currentX += columnWidths[i];
    }
    
    // Move to next row
    startY += tableOptions.padding?.top + tableOptions.fontSize?.header + tableOptions.padding?.bottom;
    
    // Draw table rows
    doc.font(tableOptions.bodyFont)
       .fontSize(tableOptions.fontSize?.body || 10);
    
    // For each row
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      // Check if we need to create a new page
      const rowHeight = tableOptions.padding?.top + tableOptions.fontSize?.body + tableOptions.padding?.bottom;
      if (startY + rowHeight > doc.page.height - (options.pageMargin || 50) - 60) {
        doc.addPage();
        startY = options.pageMargin || 50;
        
        // Add header to new page
        await addDocumentHeader(doc, logoUrl, companyName, options);
        
        // Move down from header
        doc.moveDown(3);
        startY = doc.y;
        
        // Reset font for table content
        doc.font(tableOptions.bodyFont)
           .fontSize(tableOptions.fontSize?.body || 10);
      }
      
      // Draw row background
      currentX = options.pageMargin || 50;
      const row = table.rows[rowIndex];
      
      // Alternate background colors if enabled
      if (tableOptions.alternateRowColoring && tableOptions.rowBackgroundColors) {
        const bgColor = tableOptions.rowBackgroundColors[rowIndex % tableOptions.rowBackgroundColors.length];
        doc.fillColor(bgColor)
           .rect(
             currentX,
             startY,
             columnWidths.reduce((a, b) => a + b, 0),
             rowHeight
           )
           .fill();
      }
      
      // Draw row text
      doc.fillColor('#000000'); // Reset text color to black
      for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
        const columnStyle = table.columnStyles?.[cellIndex] || {};
        const align = columnStyle.align || 'left';
        const cellFont = columnStyle.font || tableOptions.bodyFont;
        const cellFontSize = columnStyle.fontSize || tableOptions.fontSize?.body || 10;
        const textColor = columnStyle.textColor || '#000000';
        
        // Apply cell-specific styling
        doc.font(cellFont)
           .fontSize(cellFontSize)
           .fillColor(textColor);
        
        doc.text(
          row[cellIndex]?.toString() || '',
          currentX + (tableOptions.padding?.left || 8),
          startY + (tableOptions.padding?.top || 5),
          {
            width: columnWidths[cellIndex] - (tableOptions.padding?.left || 8) - (tableOptions.padding?.right || 8),
            align: align
          }
        );
        
        currentX += columnWidths[cellIndex];
      }
      
      // Draw horizontal line at bottom of row
      doc.strokeColor(tableOptions.borderColor)
         .lineWidth(0.5)
         .moveTo(options.pageMargin || 50, startY + rowHeight)
         .lineTo((options.pageMargin || 50) + columnWidths.reduce((a, b) => a + b, 0), startY + rowHeight)
         .stroke();
      
      // Move to next row
      startY += rowHeight;
    }
    
    // Move down after table
    doc.moveDown(2);
  }
}

/**
 * Add the document header with logo and company name
 */
async function addDocumentHeader(
  doc: PDFKit.PDFDocument, 
  logoUrl: string,
  companyName: string,
  options: PDFOptions
): Promise<void> {
  if (logoUrl) {
    try {
      const imageBuffer = await fetchImageBuffer(logoUrl);          
      const dimensions = imageSize.imageSize(imageBuffer);
      
      const logoWidth = options.logoWidth || 100;
      const logoHeight = dimensions.height 
        ? (dimensions.height * logoWidth) / dimensions.width
        : logoWidth;
      
      doc.image(
        imageBuffer, 
        options.pageMargin || 50, 
        options.pageMargin || 50, 
        { width: logoWidth }
      );
        
      doc.fontSize(options.companyNameFontSize || 16)
         .font(`${options.fontFamily || 'Helvetica'}-Bold`)
         .text(
           companyName, 
           (options.pageMargin || 50) + logoWidth + 20, 
           (options.pageMargin || 50) + (logoHeight/2) - 10, 
           { align: 'left' }
         );
    } catch (logoError) {
      console.warn(`Logo could not be added to new page: ${logoError.message}`);
      
      doc.fontSize(options.companyNameFontSize || 16)
         .font(`${options.fontFamily || 'Helvetica'}-Bold`)
         .text(
           companyName, 
           options.pageMargin || 50, 
           options.pageMargin || 50, 
           { align: 'left' }
         );
    }
  } else {
    doc.fontSize(options.companyNameFontSize || 16)
       .font(`${options.fontFamily || 'Helvetica'}-Bold`)
       .text(
         companyName, 
         options.pageMargin || 50, 
         options.pageMargin || 50, 
         { align: 'left' }
       );
  }
}

/**
 * Draw a bar chart on the PDF
 */
function drawBarChart(
  doc: PDFKit.PDFDocument, 
  chartData: ChartData, 
  options: PDFOptions
): void {
  const margin = options.pageMargin || 50;
  const pageWidth = doc.page.width - (margin * 2);
  
  // Set chart dimensions
  const chartWidth = chartData.width || pageWidth * 0.9;
  const chartHeight = chartData.height || 300;
  
  // Calculate the maximum value for scaling
  const maxValue = Math.max(...chartData.data);
  
  // Set bar dimensions
  const barCount = chartData.data.length;
  const barSpacing = chartWidth * 0.1 / (barCount - 1 || 1);
  const barWidth = (chartWidth * 0.9) / barCount;
  
  // Start position
  const startX = margin + (pageWidth - chartWidth) / 2;
  const startY = doc.y;
  const endY = startY + chartHeight;
  
  // Draw chart axes
  doc.strokeColor('#000000')
     .lineWidth(1)
     .moveTo(startX, startY)
     .lineTo(startX, endY)
     .moveTo(startX, endY)
     .lineTo(startX + chartWidth, endY)
     .stroke();
  
  // Draw value scale on y-axis
  const scaleSteps = 5;
  doc.fontSize(8);
  for (let i = 0; i <= scaleSteps; i++) {
    const value = maxValue * (scaleSteps - i) / scaleSteps;
    const y = startY + (i * chartHeight / scaleSteps);
    
    // Draw scale line
    doc.strokeColor('#CCCCCC')
       .moveTo(startX - 5, y)
       .lineTo(startX + chartWidth, y)
       .stroke();
    
    // Draw scale value
    doc.fillColor('#000000')
       .text(value.toFixed(0), startX - 30, y - 5, { width: 25, align: 'right' });
  }
  
  // Default colors if not provided
  const defaultColors = [
    '#4F81BD', // Blue
    '#C0504D', // Red
    '#9BBB59', // Green
    '#8064A2', // Purple
    '#F79646', // Orange
    '#4BACC6', // Cyan
    '#A9A9A9', // Gray
    '#7F7F7F', // Dark Gray
    '#B3B3B3', // Light Gray
    '#595959'  // Very Dark Gray
  ];
  
  // Draw bars
  for (let i = 0; i < barCount; i++) {
    const barHeight = (chartHeight * chartData.data[i]) / maxValue;
    const barX = startX + (i * (barWidth + barSpacing));
    const barY = endY - barHeight;
    
    // Set bar color
    const colorIndex = i % (chartData.colors?.length || defaultColors.length);
    const barColor = chartData.colors?.[colorIndex] || defaultColors[colorIndex];
    
    // Draw bar
    doc.fillColor(barColor)
       .rect(barX, barY, barWidth, barHeight)
       .fill();
    
    // Add label below x-axis
    doc.fillColor('#000000')
       .fontSize(8)
       .text(
         chartData.labels[i],
         barX,
         endY + 5,
         {
           width: barWidth,
           align: 'center'
         }
       );
  }
  
  // Update current y position
  doc.y = endY + 40;
}

/**
 * Draw a pie chart on the PDF
 */
function drawPieChart(
  doc: PDFKit.PDFDocument, 
  chartData: ChartData, 
  options: PDFOptions
): void {
  const margin = options.pageMargin || 50;
  const pageWidth = doc.page.width - (margin * 2);
  
  // Set chart dimensions
  const chartWidth = chartData.width || pageWidth * 0.7;
  const chartHeight = chartData.height || chartWidth; // Make it circular
  
  // Calculate total value for percentages
  const totalValue = chartData.data.reduce((sum, value) => sum + value, 0);
  
  // Default colors if not provided
  const defaultColors = [
    '#4F81BD', // Blue
    '#C0504D', // Red
    '#9BBB59', // Green
    '#8064A2', // Purple
    '#F79646', // Orange
    '#4BACC6', // Cyan
    '#A9A9A9', // Gray
    '#7F7F7F', // Dark Gray
    '#B3B3B3', // Light Gray
    '#595959'  // Very Dark Gray
  ];
  
  // Start position for the pie chart
  const centerX = margin + (pageWidth / 2);
  const centerY = doc.y + (chartHeight / 2);
  const radius = chartWidth / 2 * 0.8; // 80% of half width
  
  // Initial angle (start from the top)
  let currentAngle = -Math.PI / 2;
  
  // Draw chart segments
  for (let i = 0; i < chartData.data.length; i++) {
    // Skip segments with zero data
    if (chartData.data[i] === 0) continue;
    
    // Calculate segment angle
    const segmentAngle = (chartData.data[i] / totalValue) * (Math.PI * 2);
    const endAngle = currentAngle + segmentAngle;
    
    // Set segment color
    const colorIndex = i % (chartData.colors?.length || defaultColors.length);
    const segmentColor = chartData.colors?.[colorIndex] || defaultColors[colorIndex];
    
    // Draw segment
    doc.save();
    doc.fillColor(segmentColor);
    
    // Move to center
    doc.moveTo(centerX, centerY);
    
    // Draw arc
    doc.arc(centerX, centerY, radius, currentAngle, endAngle);
    
    // Draw line back to center
    doc.lineTo(centerX, centerY);
    
    // Fill the segment
    doc.fill();
    doc.restore();
    
    // Calculate middle angle for label placement
    const midAngle = currentAngle + (segmentAngle / 2);
    
    // Calculate position for percentage label (inside the segment)
    const labelRadius = radius * 0.6; // 60% of radius
    const labelX = centerX + Math.cos(midAngle) * labelRadius;
    const labelY = centerY + Math.sin(midAngle) * labelRadius;
    
    // Draw percentage label
    const percentage = ((chartData.data[i] / totalValue) * 100).toFixed(1) + '%';
    doc.fillColor('#FFFFFF') // White text for visibility
       .fontSize(9)
       .text(percentage, labelX - 12, labelY - 6, { align: 'center', width: 24 });
    
    // Update current angle
    currentAngle = endAngle;
  }
  
  // Draw legend
  const legendX = centerX + radius + 20;
  let legendY = centerY - (chartData.data.length * 15) / 2;
  
  for (let i = 0; i < chartData.data.length; i++) {
    // Skip items with zero data
    if (chartData.data[i] === 0) continue;
    
    // Set color
    const colorIndex = i % (chartData.colors?.length || defaultColors.length);
    const itemColor = chartData.colors?.[colorIndex] || defaultColors[colorIndex];
    
    // Draw color box
    doc.fillColor(itemColor)
       .rect(legendX, legendY, 10, 10)
       .fill();
    
    // Draw label
    doc.fillColor('#000000')
       .fontSize(9)
       .text(
         `${chartData.labels[i]} (${((chartData.data[i] / totalValue) * 100).toFixed(1)}%)`,
         legendX + 15,
         legendY,
         { width: 100 }
       );
    
    // Move to next legend item
    legendY += 15;
  }
  
  // Update current y position
  doc.y = centerY + radius + 20;
}
