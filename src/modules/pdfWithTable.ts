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
  tableRowSpacing: 5
};
const LOGO_MAX_WIDTH = 150;
const LOGO_MAX_HEIGHT = 50;
const TABLE_LINE_WIDTH = 0.5;

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
     .fontSize(FONT_SIZES.header)
     .text(companyName, 
          doc.page.width - margin - doc.widthOfString(companyName, { fontSize: FONT_SIZES.header }),
          startY);
  
  return headerHeight;
}

/**
 * Adds an elegant footer with page numbers
 */
function addElegantFooter(
  doc: PDFKit.PDFDocument,
  currentPage: number,
  totalPages: number,
  margin: number
): void {
  const pageBottom = doc.page.height - margin / 2;
  
  // Add current date to the left
  doc.font('Helvetica')
     .fontSize(FONT_SIZES.footer)
     .text(
       new Date().toLocaleDateString(),
       margin,
       pageBottom
     );
  
  // Add page number to the right
  const pageText = `Page ${currentPage} of ${totalPages}`;
  
  doc.text(
    pageText,
    doc.page.width - margin - doc.widthOfString(pageText, { fontSize: FONT_SIZES.footer }),
    pageBottom
  );
}

/**
 * Adds a professional table to the document
 */
function addProfessionalTable(
  doc: PDFKit.PDFDocument,
  tableData: TableData,
  startY: number,
  margin: number
): number {
  if (!tableData || !tableData.items || tableData.items.length === 0) {
    return 0;
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
    if (currentY + 20 > doc.page.height - margin) {
      doc.addPage();
      currentY = margin;
    }
    
    // Draw row cells
    xPos = margin;
    let rowTextHeight = 0;
    
    // First pass: calculate max height
    columnNames.forEach(name => {
      const cellValue = String(row[name] || '');
      const textHeight = doc.heightOfString(cellValue, {
        width: columnWidth,
        align: 'center'
      });
      rowTextHeight = Math.max(rowTextHeight, textHeight);
    });
    
    // Second pass: draw text
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
  
  return currentY - startY; // Return total table height
}

/**
 * Creates a PDF with a paragraph and a table
 */
export async function createPDFWithTable(
  logoUrl: string,
  companyName: string, 
  paragraphText: string,
  tableData: TableData,
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
      const contentStartY = startY + headerHeight + SPACING.headerToContent;
      
      // Add paragraph with proper formatting
      doc.font(fontFamily)
         .fontSize(FONT_SIZES.text)
         .text(paragraphText, 
            margin, 
            contentStartY, 
            {
              width: doc.page.width - 2 * margin,
              align: 'justify', // Justified text for professional appearance
              lineGap: 2
            });
      
      // Add table below paragraph with spacing
      const tableStartY = doc.y + SPACING.paragraphToTable;
      
      addProfessionalTable(
        doc,
        tableData,
        tableStartY,
        margin
      );
      
      // Get the total number of pages
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      
      // Apply elegant footer to each page
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        addElegantFooter(doc, i + 1, totalPages, margin);
      }
      
      resolve(doc);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error';
      reject(new Error(`Error generating PDF: ${errorMessage}`));
    }
  });
}
