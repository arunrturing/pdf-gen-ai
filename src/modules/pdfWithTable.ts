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
  outputDir?: string;
}

interface LogoResult {
  image: Buffer;
  width: number;
  height: number;
}

interface PdfContentItem {
  attributeType: 'paragraph';
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
 * Creates a PDF document with header, footer, paragraph, and table
 */
export async function createPDFWithTable(
  logoUrl: string, 
  companyName: string, 
  pdfData: PdfContentItem[],
  tableData: TableData | null = null,
  options: PDFOptions = {}
): Promise<PDFKit.PDFDocument> {
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
  
  // Get logo dimensions
  let logoResult: LogoResult | null = null;
  try {
    logoResult = await getLogoImage(logoUrl);
  } catch (error) {
    console.warn('Could not load logo image:', error);
  }

  // Add header
  if (logoResult) {
    const scaleFactor = Math.min(
      LOGO_MAX_WIDTH / logoResult.width,
      LOGO_MAX_HEIGHT / logoResult.height,
      1
    );
    
    const scaledWidth = logoResult.width * scaleFactor;
    const scaledHeight = logoResult.height * scaleFactor;
    
    doc.image(logoResult.image, DEFAULT_MARGINS.left, DEFAULT_MARGINS.top / 2, {
      width: scaledWidth,
      height: scaledHeight
    });
  }
  
  doc.font(`${fontFamily}-Bold`)
     .fontSize(HEADER_COMPANY_NAME_FONT_SIZE)
     .text(companyName, 
          doc.page.width - DEFAULT_MARGINS.right - doc.widthOfString(companyName),
          DEFAULT_MARGINS.top / 2);
  
  doc.font(fontFamily).fontSize(fontSize).moveDown(2);
  
  // Process paragraphs
  for (const item of pdfData) {
    if (item.attributeType === 'paragraph') {
      doc.font(fontFamily)
         .fontSize(fontSize)
         .text(item.content, {
            align: 'left',
            lineGap: (lineHeight - 1) * fontSize,
            width: doc.page.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right
         });
      doc.moveDown();
    }
  }
  
  // Add table
  if (tableData && tableData.items.length > 0) {
    doc.moveDown();
    
    // Add table heading
    doc.fontSize(fontSize + 2)
       .font(`${fontFamily}-Bold`)
       .text(tableData.tableHeading, {
         align: 'center'
       });
    doc.moveDown();
    
    const columnNames = Object.keys(tableData.items[0]);
    const tableWidth = doc.page.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right;
    const columnWidth = tableWidth / columnNames.length;
    
    // Table header
    let startX = DEFAULT_MARGINS.left;
    let startY = doc.y;
    
    doc.font(`${fontFamily}-Bold`).fontSize(fontSize);
    
    columnNames.forEach(name => {
      doc.text(name, startX, startY, {
        width: columnWidth,
        align: 'center'
      });
      startX += columnWidth;
    });
    
    // Draw header separator
    startY = doc.y + 5;
    doc.moveTo(DEFAULT_MARGINS.left, startY)
       .lineTo(DEFAULT_MARGINS.left + tableWidth, startY)
       .stroke();
    
    // Table rows
    doc.font(fontFamily).fontSize(fontSize);
    startY += 10;
    
    tableData.items.forEach(row => {
      // Check for page break
      if (startY + 20 > doc.page.height - DEFAULT_MARGINS.bottom) {
        doc.addPage();
        
        // Add header to new page
        if (logoResult) {
          const scaleFactor = Math.min(
            LOGO_MAX_WIDTH / logoResult.width,
            LOGO_MAX_HEIGHT / logoResult.height,
            1
          );
          
          const scaledWidth = logoResult.width * scaleFactor;
          const scaledHeight = logoResult.height * scaleFactor;
          
          doc.image(logoResult.image, DEFAULT_MARGINS.left, DEFAULT_MARGINS.top / 2, {
            width: scaledWidth,
            height: scaledHeight
          });
        }
        
        doc.font(`${fontFamily}-Bold`)
           .fontSize(HEADER_COMPANY_NAME_FONT_SIZE)
           .text(companyName, 
                doc.page.width - DEFAULT_MARGINS.right - doc.widthOfString(companyName),
                DEFAULT_MARGINS.top / 2);
        
        doc.font(fontFamily).fontSize(fontSize).moveDown(2);
        
        startY = doc.y;
      }
      
      // Draw row cells
      startX = DEFAULT_MARGINS.left;
      const rowY = startY;
      
      columnNames.forEach(name => {
        const cellValue = String(row[name] || '');
        doc.text(cellValue, startX, rowY, {
          width: columnWidth,
          align: 'center'
        });
        startX += columnWidth;
      });
      
      // Move to next row position
      startY = doc.y + 10;
      
      // Draw row separator
      doc.moveTo(DEFAULT_MARGINS.left, startY - 5)
         .lineTo(DEFAULT_MARGINS.left + tableWidth, startY - 5)
         .lineWidth(0.5)
         .stroke();
    });
  }
  
  // Add footer to all pages
  const totalPages = doc.bufferedPageRange().count;
  
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    
    const pageBottom = doc.page.height - DEFAULT_MARGINS.bottom / 2;
    
    // Current date on left
    doc.fontSize(FOOTER_FONT_SIZE)
       .font(fontFamily)
       .text(
         new Date().toLocaleDateString(),
         DEFAULT_MARGINS.left,
         pageBottom
       );
    
    // Page number on right
    const pageText = `Page ${i + 1} of ${totalPages}`;
    
    doc.text(
      pageText,
      doc.page.width - DEFAULT_MARGINS.right - doc.widthOfString(pageText),
      pageBottom
    );
  }

  return doc;
}