import { createPdf,createHeaderedParagraphsPDF } from '@modules';
import { createPDF } from '@modules';
import { createPDFWithTable } from '@modules';
import fs from 'fs';
import path from 'path';

 async function savePDFToFile(
  pdfBuffer: Buffer, 
  filename?: string
): Promise<string> {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.resolve('./test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate filename with timestamp if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = filename || `document-${timestamp}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);
    
    // Write buffer to file
    await fs.promises.writeFile(outputPath, pdfBuffer);
    console.log(`PDF saved to: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('Error saving PDF to file:', error);
    throw error;
  }
}

describe('PDF Generator', () => {

    test.skip('should generate structured PDF with createPdf function', async () => {
        // Test data with proper structure
        const logoUrl = "https://multi-tenant-dev.n-oms.in/assets/logo-hd2-BZqe1saO.png";
        const companyName = "NOMS Pvt Ltd";
        
        // Sample content data with different attributeTypes
        const pdfData: any[] = [
            {
                attributeType: 'paragraph',
                content: 'This is the first paragraph of our document. It contains important information about our company and services. This paragraph will be formatted with justified alignment and proper spacing.'
            },
            {
                attributeType: 'paragraph', 
                content: 'This is a second paragraph that provides additional details about the subject matter. It demonstrates how multiple paragraphs are handled in the PDF generation process.'
            },
            {
                attributeType: 'signature',
                content: 'John Doe'
            },
            {
                attributeType: 'designation',
                content: 'Chief Executive Officer'
            }
        ];

        // PDF options configuration
        const options: any = {
            outputPath: `./test-output/structured-document-${Date.now()}.pdf`,
            title: 'Test Structured Document',
            author: 'NOMS Pvt Ltd',
            subject: 'Unit Test Generated Document',
            keywords: ['test', 'pdf', 'generation', 'structured'],
            fontSize: 12,
            fontFamily: 'Helvetica'
        };

        // Generate the PDF
        const outputPath = await createPdf(logoUrl, companyName, pdfData, options);
        
        // Verify the PDF was created
        expect(outputPath).toBeDefined();
        expect(typeof outputPath).toBe('string');
        expect(fs.existsSync(outputPath)).toBe(true);
        
        // Check file stats
        const stats = fs.statSync(outputPath);
        expect(stats.size).toBeGreaterThan(0);
        
        console.log(`✅ Structured PDF generated successfully at: ${outputPath}`);
        console.log(`📄 File size: ${stats.size} bytes`);
        
        // Verify it's a valid PDF by checking file header
        const fileBuffer = fs.readFileSync(outputPath);
        const pdfHeader = fileBuffer.subarray(0, 4).toString();
        expect(pdfHeader).toBe('%PDF');
        
        console.log(`🔍 PDF header validation: ${pdfHeader} ✅`);
    });

    test.skip('should generate PDF with paragraphs using createParagraphsPDF', async () => {
        // Test data with sample paragraphs
        const paragraphs = [
            'This is the first paragraph of our document. It demonstrates the paragraph-based PDF generation functionality with proper left alignment and spacing.',
            'This is a second paragraph that shows how multiple paragraphs are handled. Each paragraph maintains proper formatting and spacing between them.',
            'The third paragraph continues to demonstrate the functionality. This ensures that the PDF generation can handle multiple paragraphs effectively.',
            'Finally, this last paragraph completes our test document. It validates that all paragraphs are rendered correctly with consistent formatting.'
        ];

        // PDF options configuration
        const options = {
            font: 'Helvetica',
            fontSize: 12,
            marginLeft: 72,
            marginRight: 72,
            marginTop: 72,
            marginBottom: 72,
            lineHeight: 1.5,
            outputPath: `./test-output/paragraphs-document-${Date.now()}.pdf`
        };

        const logoUrl = "https://multi-tenant-dev.n-oms.in/assets/logo-hd2-BZqe1saO.png";
        // Generate the PDF
        const pdfBuffer = await createHeaderedParagraphsPDF(logoUrl,"Test", paragraphs, options);
        
        // Verify the PDF buffer
        expect(pdfBuffer).toBeDefined();
        expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
        expect(pdfBuffer.length).toBeGreaterThan(0);
        
        // Verify the file was created at the specified path
        expect(fs.existsSync(options.outputPath)).toBe(true);
        
        // Check file stats
        const stats = fs.statSync(options.outputPath);
        expect(stats.size).toBeGreaterThan(0);
        
        console.log(`✅ Paragraphs PDF generated successfully at: ${options.outputPath}`);
        console.log(`📄 File size: ${stats.size} bytes`);
        
        // Verify it's a valid PDF by checking file header
        const fileBuffer = fs.readFileSync(options.outputPath);
        const pdfHeader = fileBuffer.subarray(0, 4).toString();
        expect(pdfHeader).toBe('%PDF');
        
        console.log(`🔍 PDF header validation: ${pdfHeader} ✅`);
    });

    test.skip('should generate PDF with header, content, signature and footer using createPDF', async () => {
        // Test data configuration
        const logoUrl = "https://multi-tenant-dev.n-oms.in/assets/logo-hd2-BZqe1saO.png";
        const companyName = "NOMS Pvt Ltd";
        const paragraphText = "This is a comprehensive test document that demonstrates the createPDF function from pdfWithFooter module. It includes a header with logo and company name, main content paragraph, signature section, and footer with page numbers and date. This function is designed to create professional documents with all necessary elements properly positioned and formatted.";
        
        const signatureInfo = {
            name: "John Doe",
            designation: "Chief Executive Officer"
        };

        const options = {
            outputPath: `./test-output/footer-document-${Date.now()}.pdf`,
            margin: 50,
            headerHeight: 80,
            footerHeight: 50,
            fontSize: {
                header: 16,
                text: 12,
                footer: 10,
                signature: 12,
                designation: 10
            }
        };

        // Generate the PDF
        const outputPath = await createPDF(logoUrl, companyName, paragraphText, signatureInfo, options);
        
        // Verify the PDF was created
        expect(outputPath).toBeDefined();
        expect(typeof outputPath).toBe('string');
        expect(outputPath).toBe(options.outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
        
        // Check file stats
        const stats = fs.statSync(outputPath);
        expect(stats.size).toBeGreaterThan(0);
        
        console.log(`✅ Footer PDF generated successfully at: ${outputPath}`);
        console.log(`📄 File size: ${stats.size} bytes`);
        
        // Verify it's a valid PDF by checking file header
        const fileBuffer = fs.readFileSync(outputPath);
        const pdfHeader = fileBuffer.subarray(0, 4).toString();
        expect(pdfHeader).toBe('%PDF');
        
        console.log(`🔍 PDF header validation: ${pdfHeader} ✅`);
    });

    test('should generate PDF with table using createPDFWithTable', async () => {
        // Test data configuration
        const logoUrl = "https://multi-tenant-dev.n-oms.in/assets/logo-hd2-BZqe1saO.png";
        const companyName = "NOMS Pvt Ltd";
        
        // Sample content data with paragraphs and signature
        const pdfData:any = [
            {
                attributeType: 'paragraph' as const,
                content: 'This document demonstrates the PDF generation functionality with table support. The table below shows our monthly sales performance data.'
            },
            {
                attributeType: 'paragraph' as const,
                content: 'Our sales team has consistently achieved growth targets throughout the reporting period, as evidenced by the data presented in the following table.'
            },
            {
                attributeType: 'signature' as const,
                content: 'John Doe'
            },
            {
                attributeType: 'designation' as const,
                content: 'Chief Executive Officer'
            }
        ];

        // Table data as provided
        const tableData = {
            tableHeading: 'Monthly Sales Report',
            items: [
                { Month: 'January', Sales: 10000, Units: 250 },
                { Month: 'February', Sales: 12500, Units: 300 },
                { Month: 'March', Sales: 15000, Units: 350 },
                { Month: 'April', Sales: 18000, Units: 400 }
            ]
        };

        // PDF options configuration
        const options = {
            fontFamily: 'Helvetica',
            fontSize: 12,
            lineHeight: 1.5,
            margins: {
                top: 72,
                bottom: 72,
                left: 72,
                right: 72
            }
        };

        const pdfDocument = await createPDFWithTable(logoUrl, companyName, pdfData, tableData, options);
        
        // Create output path for saving
        const outputPath = `./test-output/table-document-${Date.now()}.pdf`;
        
        // Create output directory if it doesn't exist
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save the PDF to file
        const writeStream = fs.createWriteStream(outputPath);
        pdfDocument.pipe(writeStream);
        pdfDocument.end();

        // Wait for the file to be written
        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
        
        // Verify the PDF was created
        expect(fs.existsSync(outputPath)).toBe(true);
        
        // Check file stats
        const stats = fs.statSync(outputPath);
        expect(stats.size).toBeGreaterThan(0);
        
        console.log(`✅ Table PDF generated successfully at: ${outputPath}`);
        console.log(`📄 File size: ${stats.size} bytes`);
        
        // Verify it's a valid PDF by checking file header
        const fileBuffer = fs.readFileSync(outputPath);
        const pdfHeader = fileBuffer.subarray(0, 4).toString();
        expect(pdfHeader).toBe('%PDF');
        
        console.log(`🔍 PDF header validation: ${pdfHeader} ✅`);
        console.log(`📊 Table data: ${tableData.items.length} rows with ${Object.keys(tableData.items[0]).length} columns`);
    });
});