import PDFDocument from 'pdfkit';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { imageSize } from 'image-size';
import { Buffer } from 'buffer';

// Constants
const DEFAULT_MARGIN = 72;
const FONT_SIZES = {
  header: 16,
  text: 12,
  tableHeading: 14,
  tableHeader: 12,
  tableCell: 11,
  footer: 10
};
const SPACING = {
  headerToContent: 30,
  paragraphToTable: 20,
  tablesToTable: 30,
  tableRowSpacing: 5
};
const LOGO_MAX_WIDTH = 150;
const LOGO_MAX_HEIGHT = 50;
const TABLE_LINE_WIDTH = 0.5;
const FOOTER_MARGIN_BOTTOM = 15;

// Interfaces
interface PDFOptions {
  margin?: number;
  fontFamily?: string;
}

interface LogoResult {
  image: Buffer;
  width: number;
  height: number;
}

interface TableData {
  tableHeading: string;
  items: Array<Record<string, string | number>>;
}

/**
 * Fetches an image from a URL and returns it as a buffer with dimensions
 */
async function getLogoImage(logoUrl: string): Promise<LogoResult> {
  try {
    let imageBuffer: Buffer;
    
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    } else {
      imageBuffer = fs.readFileSync(logoUrl);
    }
    
    const dimensions = imageSize(imageBuffer);
    
    if (!dimensions || !dimensions.width || !dimensions.height) {
      throw new Error('Could not determine image dimensions');
    }
    
    return {
      image: imageBuffer,
      width: dimensions.width,
      height: dimensions.height
    };
  } catch (error) {
    console.error('Error fetching logo image:', error);
    throw error;
  }
}

/**
 * Adds an elegant header with logo and company name
 */
async function addElegantHeader(
  doc: PDFKit.PDFDocument,
  logoUrl: string,
  companyName: string,
  margin: number,
  startY: number
): Promise<number> {
  let headerHeight = FONT_SIZES.header;
  
  try {
    const logoResult = await getLogoImage(logoUrl);
    
    // Calculate scaled dimensions to maintain aspect ratio
    const scaleFactor = Math.min(
      LOGO_MAX_WIDTH / logoResult.width,
      LOGO_MAX_HEIGHT / logoResult.height,
      1
    );
    
    const scaledWidth = logoResult.width * scaleFactor;
    const scaledHeight = logoResult.height * scaleFactor;
    
    // Add logo to the left side
    doc.image(logoResult.image, margin, startY, {
      width: scaledWidth,
      height: scaledHeight
    });
    
    headerHeight = Math.max(headerHeight, scaledHeight);
  } catch (error) {
    console.warn('Could not load logo image:', error);
    // Continue without logo
  }
  
  // Add company name to the right side
  doc.font('Helvetica-Bold')
     .fontSize(FONT_SIZES.header);
     
  const companyNameWidth = doc.widthOfString(companyName);
  
  doc.text(companyName, 
      doc.page.width - margin - companyNameWidth,
      startY);
  
  return headerHeight;
}

/**
 * Adds an elegant footer with page numbers on the same page as content
 */
function addElegantFooter(
  doc: PDFKit.PDFDocument,
  pageNumber: number,
  totalPages: number,
  margin: number
): void {
  // Calculate footer position at bottom of page
  const footerY = doc.page.height - margin - FOOTER_MARGIN_BOTTOM;
  
  // Format date with elegant format
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  // Save current drawing state
  doc.save();
  
  // Add subtle line above footer
  doc.strokeColor('#cccccc')
     .lineWidth(0.5)
     .moveTo(margin, footerY - 10)
     .lineTo(doc.page.width - margin, footerY - 10)
     .stroke();

  // Return to default color
  doc.fillColor('black');
  
  // Add date on left side of footer
  doc.font('Helvetica')
     .fontSize(FONT_SIZES.footer)
     .text(currentDate, 
           margin, 
           footerY, 
           { align: 'left' });

  // Add page number on right side (same footer, same page)
  doc.text(`Page ${pageNumber} of ${totalPages}`,
           doc.page.width - margin - 100,
           footerY,
           { align: 'right', width: 100 });
  
  // Restore drawing state
  doc.restore();
}

/**
 * Adds a professional table to the document
 */
function addProfessionalTable(
  doc: PDFKit.PDFDocument,
  tableData: TableData,
  startY: number,
  margin: number,
  availableHeight: number
): number {
  if (!tableData || !tableData.items || tableData.items.length === 0) {
    return startY;
  }
  
  let currentY = startY;
  
  // Add table heading
  doc.font('Helvetica-Bold')
     .fontSize(FONT_SIZES.tableHeading)
     .text(tableData.tableHeading, margin, currentY, {
       align: 'center',
       width: doc.page.width - 2 * margin
     });
  
  currentY = doc.y + SPACING.tableRowSpacing;
  
  // Get column names and calculate column widths
  const columnNames = Object.keys(tableData.items[0]);
  const tableWidth = doc.page.width - 2 * margin;
  const columnWidth = tableWidth / columnNames.length;
  
  // Draw table header
  doc.font('Helvetica-Bold')
     .fontSize(FONT_SIZES.tableHeader);
  
  // Check if we need a new page
  if (currentY + 40 > availableHeight) {
    doc.addPage();
    currentY = margin;
    
    // Re-add table heading on new page
    doc.font('Helvetica-Bold')
       .fontSize(FONT_SIZES.tableHeading)
       .text(tableData.tableHeading, margin, currentY, {
         align: 'center',
         width: doc.page.width - 2 * margin
       });
    
    currentY = doc.y + SPACING.tableRowSpacing;
    
    doc.font('Helvetica-Bold')
       .fontSize(FONT_SIZES.tableHeader);
  }
  
  let xPos = margin;
  columnNames.forEach(name => {
    doc.text(name, xPos, currentY, {
      width: columnWidth,
      align: 'center'
    });
    xPos += columnWidth;
  });
  
  currentY = doc.y + SPACING.tableRowSpacing;
  
  // Draw header separator
  doc.moveTo(margin, currentY)
     .lineTo(margin + tableWidth, currentY)
     .stroke();
  
  currentY += SPACING.tableRowSpacing;
  
  // Draw table rows
  doc.font('Helvetica')
     .fontSize(FONT_SIZES.tableCell);
  
  tableData.items.forEach(row => {
    // Check for page break
    if (currentY + 30 > availableHeight) {
      doc.addPage();
      currentY = margin;
      
      // Re-draw table header on new page
      doc.font('Helvetica-Bold')
         .fontSize(FONT_SIZES.tableHeader);
         
      xPos = margin;
      columnNames.forEach(name => {
        doc.text(name, xPos, currentY, {
          width: columnWidth,
          align: 'center'
        });
        xPos += columnWidth;
      });
      
      currentY = doc.y + SPACING.tableRowSpacing;
      
      // Draw header separator
      doc.moveTo(margin, currentY)
         .lineTo(margin + tableWidth, currentY)
         .stroke();
         
      currentY += SPACING.tableRowSpacing;
      
      doc.font('Helvetica')
         .fontSize(FONT_SIZES.tableCell);
    }
    
    // Draw row cells
    xPos = margin;
    
    columnNames.forEach(name => {
      const cellValue = String(row[name] || '');
      doc.text(cellValue, xPos, currentY, {
        width: columnWidth,
        align: 'center'
      });
      xPos += columnWidth;
    });
    
    currentY = doc.y + SPACING.tableRowSpacing;
    
    // Draw row separator
    doc.lineWidth(TABLE_LINE_WIDTH)
       .moveTo(margin, currentY)
       .lineTo(margin + tableWidth, currentY)
       .stroke();
    
    currentY += SPACING.tableRowSpacing;
  });
  
  return currentY; // Return the current Y position after the table
}

/**
 * Creates a PDF with multiple tables arranged vertically
 */
export async function createMultipleTables(
  logoUrl: string,
  companyName: string, 
  paragraphText: string,
  tables: TableData[],
  options: PDFOptions = {}
): Promise<PDFKit.PDFDocument> {
  return new Promise<PDFKit.PDFDocument>(async (resolve, reject) => {
    try {
      const margin = options.margin || DEFAULT_MARGIN;
      const fontFamily = options.fontFamily || 'Helvetica';
      
      // Create PDF document
      const doc = new PDFDocument({ 
        autoFirstPage: true,
        margin
      });
      
      // Set initial position
      const startY = margin;
      
      // Add professional header with logo and company name
      const headerHeight = await addElegantHeader(
        doc,
        logoUrl,
        companyName,
        margin,
        startY
      );
      
      // Add clear spacing after header
      let currentY = startY + headerHeight + SPACING.headerToContent;
      
      // Add paragraph with proper formatting
      if (paragraphText) {
        doc.font(fontFamily)
           .fontSize(FONT_SIZES.text)
           .text(paragraphText, 
              margin, 
              currentY, 
              {
                width: doc.page.width - 2 * margin,
                align: 'justify',
                lineGap: 2
              });
        
        currentY = doc.y + SPACING.paragraphToTable;
      }
      
      // Calculate available height for content (excluding footer)
      const footerSpace = margin + FOOTER_MARGIN_BOTTOM + 20;
      const availableHeight = doc.page.height - footerSpace;
      
      // Add each table one after another
      for (let i = 0; i < tables.length; i++) {
        // Add spacing between tables (except before first table)
        if (i > 0) {
          currentY += SPACING.tablesToTable;
        }
        
        // Check if we need to start a new page for this table
        if (currentY + 100 > availableHeight) { // 100px minimum space for table header and at least one row
          doc.addPage();
          currentY = margin;
        }
        
        // Add the table and get the ending Y position
        currentY = addProfessionalTable(
          doc,
          tables[i],
          currentY,
          margin,
          availableHeight
        );
      }
      
      // Add footers to all pages
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        addElegantFooter(doc, i + 1, totalPages, margin);
      }
      
      resolve(doc);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error';
      reject(new Error(`Error generating PDF with multiple tables: ${errorMessage}`));
    }
  });
}