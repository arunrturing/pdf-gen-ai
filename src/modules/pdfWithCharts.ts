import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as imageSize from 'image-size';

// Interface definitions
interface TableData {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
  widths?: number[];
}

interface ChartData {
  type: 'bar' | 'pie';
  title?: string;
  labels: string[];
  data: number[];
  colors?: string[];
  width?: number;
  height?: number;
}

interface PDFOptions {
  outputPath?: string;
  pageMargin?: number;
  fontFamily?: string;
  fontSize?: number;
  companyNameFontSize?: number;
  logoWidth?: number;
}

/**
 * Creates a PDF with bar charts, pie charts, and tables
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
  options: PDFOptions = {}
): Promise<Buffer> {
  // Default options
  const pageMargin = options.pageMargin || 50;
  const fontFamily = options.fontFamily || 'Helvetica';
  const fontSize = options.fontSize || 12;
  const companyNameFontSize = options.companyNameFontSize || 16;
  const logoWidth = options.logoWidth || 100;

  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        autoFirstPage: true,
        bufferPages: true,
        size: 'A4',
        margin: pageMargin
      });

      // Collect the PDF data chunks
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });
      
      doc.on('error', (err: Error) => {
        reject(new Error(`PDF generation error: ${err.message}`));
      });

      // Add header with logo and company name
      if (logoUrl) {
        try {
          const imageBuffer = await fetchImageBuffer(logoUrl);
          const dimensions = imageSize.imageSize(imageBuffer);
          
          // Add logo to top left
          doc.image(
            imageBuffer, 
            pageMargin, 
            pageMargin, 
            { width: logoWidth }
          );
            
          // Add company name next to logo
          const logoHeight = dimensions.height 
            ? (dimensions.height * logoWidth) / (dimensions.width || 1)
            : logoWidth;
            
          doc.fontSize(companyNameFontSize)
             .font(`${fontFamily}-Bold`)
             .text(
               companyName, 
               pageMargin + logoWidth + 20, 
               pageMargin + (logoHeight/2) - 10, 
               { align: 'left' }
             );
        } catch (logoError) {
          console.warn(`Logo could not be added: ${(logoError as Error).message}`);
          
          // Add company name at the top left if logo fails
          doc.fontSize(companyNameFontSize)
             .font(`${fontFamily}-Bold`)
             .text(
               companyName, 
               pageMargin, 
               pageMargin, 
               { align: 'left' }
             );
        }
      } else {
        // No logo, just add company name at the top left
        doc.fontSize(companyNameFontSize)
           .font(`${fontFamily}-Bold`)
           .text(
             companyName, 
             pageMargin, 
             pageMargin, 
             { align: 'left' }
           );
      }
      
      // Move down after header
      doc.moveDown(3);
      
      // Reset font for content
      doc.font(fontFamily).fontSize(fontSize);

      // Render tables
      for (const table of tables) {
        await renderTable(doc, table, pageMargin, fontFamily, fontSize);
        doc.moveDown(2);
      }

      // Render charts
      for (const chart of charts) {
        // Check if we need a new page
        if (doc.y + (chart.height || 300) + 50 > doc.page.height - pageMargin) {
          doc.addPage();
        }

        if (chart.title) {
          doc.font(`${fontFamily}-Bold`)
             .fontSize(14)
             .text(chart.title, { align: 'center' })
             .moveDown();
        }

        if (chart.type === 'bar') {
          renderBarChart(doc, chart, pageMargin);
        } else if (chart.type === 'pie') {
          renderPieChart(doc, chart, pageMargin);
        }

        doc.moveDown(2);
      }

      // Add page numbers
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(10)
           .text(
             `Page ${i + 1} of ${totalPages}`,
             0,
             doc.page.height - pageMargin - 20,
             { align: 'center' }
           );
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(new Error(`Error in PDF creation: ${(error as Error).message}`));
    }
  });
}

/**
 * Fetches an image from a URL or path and returns it as a buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000
      });
      return Buffer.from(response.data);
    } else {
      // Assume it's a local file
      return fs.promises.readFile(url);
    }
  } catch (error) {
    throw new Error(`Failed to fetch image: ${(error as Error).message}`);
  }
}

/**
 * Renders a table in the PDF document
 */
async function renderTable(
  doc: PDFKit.PDFDocument,
  table: TableData, 
  pageMargin: number,
  fontFamily: string,
  fontSize: number
): Promise<void> {
  // Add table title if provided
  if (table.title) {
    doc.font(`${fontFamily}-Bold`)
       .fontSize(14)
       .text(table.title, { align: 'center' })
       .moveDown();
  }

  // Calculate column widths
  const availableWidth = doc.page.width - (pageMargin * 2);
  const columnWidths = table.widths || 
    new Array(table.headers.length).fill(availableWidth / table.headers.length);

  // Current position
  let startY = doc.y;
  const headerHeight = 20;
  const rowHeight = 15;

  // Draw header
  let x = pageMargin;
  doc.fillColor('#D3D3D3');  // Light gray background for header
  doc.rect(pageMargin, startY, availableWidth, headerHeight).fill();
  
  doc.fillColor('#000000');  // Black text for header
  doc.font(`${fontFamily}-Bold`).fontSize(fontSize);
  
  for (let i = 0; i < table.headers.length; i++) {
    doc.text(
      table.headers[i],
      x + 5,
      startY + 5,
      { width: columnWidths[i] - 10 }
    );
    x += columnWidths[i];
  }

  // Move to first row
  startY += headerHeight;
  doc.font(fontFamily).fontSize(fontSize - 1);

  // Draw rows
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    // Check if we need a new page
    if (startY + rowHeight > doc.page.height - pageMargin - 30) {
      doc.addPage();
      startY = pageMargin + 20;
    }

    const row = table.rows[rowIndex];

    // Alternate row colors
    if (rowIndex % 2 === 1) {
      doc.fillColor('#F5F5F5');  // Light gray for alternate rows
      doc.rect(pageMargin, startY, availableWidth, rowHeight).fill();
    }

    // Draw cells
    x = pageMargin;
    doc.fillColor('#000000');  // Reset text color
    
    for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
      const cellText = row[cellIndex]?.toString() || '';
      
      doc.text(
        cellText,
        x + 5,
        startY + 3,
        { width: columnWidths[cellIndex] - 10 }
      );
      
      x += columnWidths[cellIndex];
    }

    // Move to next row
    startY += rowHeight;
  }

  // Update document position
  doc.y = startY + 10;
}

/**
 * Renders a bar chart in the PDF document
 */
function renderBarChart(
  doc: PDFKit.PDFDocument,
  chart: ChartData,
  pageMargin: number
): void {
  const chartWidth = chart.width || 400;
  const chartHeight = chart.height || 300;
  
  // Start position
  const startX = pageMargin;
  const startY = doc.y;
  
  // Calculate max value for scaling
  const maxValue = Math.max(...chart.data);
  
  // Bar dimensions
  const barWidth = chartWidth / chart.data.length * 0.8;
  const spacing = chartWidth / chart.data.length * 0.2;
  
  // Default colors
  const defaultColors = [
    '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#F79646', 
    '#4BACC6', '#A9A9A9', '#7F7F7F'
  ];
  
  // Draw axes
  doc.strokeColor('#000000')
     .lineWidth(1)
     .moveTo(startX, startY)
     .lineTo(startX, startY + chartHeight)
     .lineTo(startX + chartWidth, startY + chartHeight)
     .stroke();
  
  // Draw bars
  for (let i = 0; i < chart.data.length; i++) {
    const barHeight = (chart.data[i] / maxValue) * chartHeight;
    const barX = startX + (i * (barWidth + spacing)) + spacing/2;
    const barY = startY + chartHeight - barHeight;
    
    // Choose color
    const colorIndex = i % defaultColors.length;
    const barColor = chart.colors?.[i] || defaultColors[colorIndex];
    
    // Draw bar
    doc.fillColor(barColor)
       .rect(barX, barY, barWidth, barHeight)
       .fill();
    
    // Add label
    doc.fillColor('#000000')
       .fontSize(8)
       .text(
         chart.labels[i],
         barX,
         startY + chartHeight + 5,
         { width: barWidth, align: 'center' }
       );
  }
  
  // Update position
  doc.y = startY + chartHeight + 30;
}

/**
 * Renders a pie chart in the PDF document
 */
function renderPieChart(
  doc: PDFKit.PDFDocument,
  chart: ChartData,
  pageMargin: number
): void {
  const chartWidth = chart.width || 300;
  const chartHeight = chart.height || 300;
  
  // Calculate center and radius
  const centerX = pageMargin + (chartWidth / 2);
  const centerY = doc.y + (chartHeight / 2);
  const radius = Math.min(chartWidth, chartHeight) / 2 * 0.8;
  
  // Calculate total for percentages
  const total = chart.data.reduce((sum, val) => sum + val, 0);
  
  // Default colors
  const defaultColors = [
    '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#F79646', 
    '#4BACC6', '#A9A9A9', '#7F7F7F'
  ];
  
  // Draw pie segments
  let startAngle = 0;
  
  for (let i = 0; i < chart.data.length; i++) {
    // Calculate angles
    const slicePercent = chart.data[i] / total;
    const endAngle = startAngle + slicePercent * Math.PI * 2;
    
    // Choose color
    const colorIndex = i % defaultColors.length;
    const sliceColor = chart.colors?.[i] || defaultColors[colorIndex];
    
    // Draw slice
    doc.fillColor(sliceColor)
       .moveTo(centerX, centerY)
       .arc(centerX, centerY, radius, startAngle, endAngle, false)
       .lineTo(centerX, centerY)
       .closePath()
       .fill();
    
    // Update angle
    startAngle = endAngle;
  }
  
  // Draw legend
  const legendX = pageMargin + chartWidth + 20;
  let legendY = doc.y + 20;
  
  for (let i = 0; i < chart.data.length; i++) {
    // Choose color
    const colorIndex = i % defaultColors.length;
    const itemColor = chart.colors?.[i] || defaultColors[colorIndex];
    
    // Draw color box
    doc.fillColor(itemColor)
       .rect(legendX, legendY, 10, 10)
       .fill();
    
    // Draw label
    const percent = Math.round((chart.data[i] / total) * 100);
    doc.fillColor('#000000')
       .fontSize(10)
       .text(
         `${chart.labels[i]} (${percent}%)`,
         legendX + 15,
         legendY,
         { width: 100 }
       );
    
    // Move to next legend item
    legendY += 20;
  }
  
  // Update position
  doc.y = centerY + radius + 20;
}