import PDFDocument from 'pdfkit';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { imageSize } from 'image-size';
import { Buffer } from 'buffer';

// Constants
const DEFAULT_FONT = 'Helvetica';
const DEFAULT_FONT_SIZE = 12;
const DEFAULT_LINE_HEIGHT = 1.5;
const DEFAULT_MARGINS = {
  top: 72,
  bottom: 72,
  left: 72,
  right: 72
};
const HEADER_COMPANY_NAME_FONT_SIZE = 16;
const LOGO_MAX_HEIGHT = 50;
const LOGO_MAX_WIDTH = 150;
const FOOTER_FONT_SIZE = 10;
const PAGE_NUMBER_FORMAT = 'Page %d of %d';

// Interfaces
interface PDFOptions {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  headerTopOffset?: number;
  outputDir?: string;
}

interface LogoResult {
  image: Buffer;
  width: number;
  height: number;
}

interface PdfContentItem {
  attributeType: 'paragraph' | 'signature' | 'designation';
  content: string;
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
    // Handle both remote URLs and local file paths
    let imageBuffer: Buffer;
    
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      // Remote URL - fetch using axios
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    } else {
      // Local file path
      imageBuffer = fs.readFileSync(logoUrl);
    }
    
    // Determine dimensions
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
 * Creates a PDF document with a header, footer, content paragraphs, and table
 */
export async function createPDFWithTable(
  logoUrl: string, 
  companyName: string, 
  pdfData: PdfContentItem[],
  tableData: TableData | null = null,
  options: PDFOptions = {}
): Promise<typeof PDFDocument> {
  // Create a new PDF document
  const doc = new PDFDocument({ 
    autoFirstPage: true,
    margins: {
      top: options.margins?.top || DEFAULT_MARGINS.top,
      bottom: options.margins?.bottom || DEFAULT_MARGINS.bottom,
      left: options.margins?.left || DEFAULT_MARGINS.left,
      right: options.margins?.right || DEFAULT_MARGINS.right
    }
  });

  // Set default font and size
  const fontFamily = options.fontFamily || DEFAULT_FONT;
  const fontSize = options.fontSize || DEFAULT_FONT_SIZE;
  const lineHeight = options.lineHeight || DEFAULT_LINE_HEIGHT;
  
  doc.font(fontFamily).fontSize(fontSize);
  
  // Track total pages and current page
  let totalPages = 1;
  let currentPage = 1;
  
  doc.on('pageAdded', () => {
    totalPages++;
    currentPage++;
  });

  // Get logo dimensions
  let logoResult: LogoResult | null = null;
  try {
    logoResult = await getLogoImage(logoUrl);
  } catch (error) {
    console.warn('Could not load logo image:', error);
    // Continue without logo
  }

  // Function to add header to each page
  const addHeader = (headerTopOffset = options.headerTopOffset || DEFAULT_MARGINS.top / 2) => {
    const pageTop = headerTopOffset;
    
    // Start header at the specified Y position
    let currentY = pageTop;
    
    // Add logo if available
    if (logoResult) {
      // Calculate scaled dimensions to maintain aspect ratio
      const scaleFactor = Math.min(
        LOGO_MAX_WIDTH / logoResult.width,
        LOGO_MAX_HEIGHT / logoResult.height,
        1 // Don't scale up small images
      );
      
      const scaledWidth = logoResult.width * scaleFactor;
      const scaledHeight = logoResult.height * scaleFactor;
      
      // Add logo to the left side
      doc.image(logoResult.image, DEFAULT_MARGINS.left, currentY, {
        width: scaledWidth,
        height: scaledHeight
      });
      
      // Update currentY to be below the logo if needed
      currentY += scaledHeight;
    }
    
    // Add company name to the right side
    doc.font(`${fontFamily}-Bold`)
       .fontSize(HEADER_COMPANY_NAME_FONT_SIZE)
       .text(companyName, 
            doc.page.width - DEFAULT_MARGINS.right - doc.widthOfString(companyName),
            pageTop);
    
    // Reset font and return the header height
    doc.font(fontFamily).fontSize(fontSize);
    
    // Add some space after the header
    doc.moveDown(2);
    return Math.max(currentY - pageTop, HEADER_COMPANY_NAME_FONT_SIZE) + 20;
  };

  // Function to add footer to each page
  const addFooter = () => {
    const pageBottom = doc.page.height - DEFAULT_MARGINS.bottom / 2;
    
    // Add current date to the left
    doc.font(fontFamily)
       .fontSize(FOOTER_FONT_SIZE)
       .text(
         new Date().toLocaleDateString(),
         DEFAULT_MARGINS.left,
         pageBottom
       );
    
    // Add page number to the right
    // Note: Using the tracked currentPage and totalPages instead of accessing page properties
    const pageText = PAGE_NUMBER_FORMAT
      .replace('%d', String(currentPage))
      .replace('%d', String(totalPages));
      
    doc.text(
      pageText,
      doc.page.width - DEFAULT_MARGINS.right - doc.widthOfString(pageText),
      pageBottom
    );
  };

  // Add header to the first page
  const headerHeight = addHeader();
  
  // Process content items
  for (const item of pdfData) {
    switch (item.attributeType) {
      case 'paragraph':
        doc.font(fontFamily)
           .fontSize(fontSize)
           .text(item.content, {
              align: 'left',
              lineGap: (lineHeight - 1) * fontSize,
              width: doc.page.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right,
              indent: 0
           });
        doc.moveDown();
        break;
      
      case 'signature':
        doc.font(`${fontFamily}-Bold`)
           .fontSize(fontSize)
           .text(item.content, {
              align: 'left',
              width: doc.page.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right
           });
        break;
      
      case 'designation':
        doc.font(fontFamily)
           .fontSize(fontSize - 2)
           .text(item.content, {
              align: 'left',
              width: doc.page.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right
           });
        doc.moveDown();
        break;
    }
  }
  
  // Add table if provided
  if (tableData && tableData.items.length > 0) {
    // Add some spacing before table
    doc.moveDown();
    
    // Add table heading
    doc.font(`${fontFamily}-Bold`)
       .fontSize(fontSize + 2)
       .text(tableData.tableHeading, {
         align: 'center',
         width: doc.page.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right
       });
    doc.moveDown();
    
    // Get column names from first item
    const columnNames = Object.keys(tableData.items[0]);
    
    // Calculate column widths (equal distribution)
    const tableWidth = doc.page.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right;
    const columnWidth = tableWidth / columnNames.length;
    
    // Draw table header
    doc.font(`${fontFamily}-Bold`)
       .fontSize(fontSize);
       
    let xPos = DEFAULT_MARGINS.left;
    let yPos = doc.y;
    
    columnNames.forEach(columnName => {
      doc.text(columnName, xPos, yPos, {
        width: columnWidth,
        align: 'center'
      });
      xPos += columnWidth;
    });
    
    // Move to position after all header cells
    doc.y = yPos + fontSize + 5;
    
    // Draw a line under the header
    doc.moveTo(DEFAULT_MARGINS.left, doc.y)
       .lineTo(doc.page.width - DEFAULT_MARGINS.right, doc.y)
       .stroke();
       
    doc.moveDown(0.5);
    
    // Draw table rows
    doc.font(fontFamily)
       .fontSize(fontSize);
       
    tableData.items.forEach((item, index) => {
      // Check if we're close to the bottom of the page and need a new page
      if (doc.y + 5 * fontSize > doc.page.height - DEFAULT_MARGINS.bottom) {
        doc.addPage();
        addHeader();
      }
      
      // Draw each cell in the row
      xPos = DEFAULT_MARGINS.left;
      yPos = doc.y;
      
      columnNames.forEach(columnName => {
        const cellContent = String(item[columnName] || '');
        doc.text(cellContent, xPos, yPos, {
          width: columnWidth,
          align: 'center'
        });
        xPos += columnWidth;
      });
      
      // Move to position after all header cells
      doc.y = yPos + fontSize + 5;
      
      // Draw a light line under the row
      doc.moveTo(DEFAULT_MARGINS.left, doc.y)
         .lineTo(doc.page.width - DEFAULT_MARGINS.right, doc.y)
         .lineWidth(0.5)
         .stroke();
         
      doc.moveDown(0.5);
    });
  }
  
  // Add footer to each page
  addFooter();
  
  // Register event to add header and footer to new pages
  doc.on('pageAdded', () => {
    addHeader();
    addFooter();
  });

  return doc;
}


