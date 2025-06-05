import { createPdf,createParagraphsPDF } from '@modules';
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
    // test('should generate PDF with company name only', async () => {
    //     const companyName = "Test Company Ltd";
    //     const logoUrl = "";
        
    //     const pdfBuffer = await createBasePDF(logoUrl, companyName);
        
    //     expect(pdfBuffer).toBeDefined();
    //     expect(pdfBuffer.length).toBeGreaterThan(0);
    //     expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    // });

    // test('should generate PDF with company name and logo URL', async () => {
    //     const companyName = "NOMS Pvt Ltd";
    //     const logoUrl = "https://multi-tenant-dev.n-oms.in/assets/logo-hd2-BZqe1saO.png";
        
    //     const pdfBuffer = await createBasePDF(logoUrl, companyName);
        
    //     expect(pdfBuffer).toBeDefined();
    //     //expect(pdfBuffer.length).toBeGreaterThan(70000);
    //     expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    //     const pdfPath = await savePDFToFile(pdfBuffer, `company-${Date.now()}.pdf`);
    //     console.log(`PDF saved successfully at: ${pdfPath}`);
    // });

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

    test('should generate PDF with paragraphs using createParagraphsPDF', async () => {
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

        // Generate the PDF
        const pdfBuffer = await createParagraphsPDF(paragraphs, options);
        
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

    test('should generate PDF with empty paragraphs filtered out', async () => {
        // Test data with some empty paragraphs
        const paragraphs = [
            'This is a valid paragraph.',
            '',
            '   ',
            'This is another valid paragraph after empty ones.',
            null as any,
            'Final paragraph to test filtering.'
        ];

        // Generate the PDF without saving to file
        const pdfBuffer = await createParagraphsPDF(paragraphs);
        
        // Verify the PDF buffer
        expect(pdfBuffer).toBeDefined();
        expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
        expect(pdfBuffer.length).toBeGreaterThan(0);
        
        console.log(`✅ Empty paragraphs filtering test completed successfully`);
        console.log(`📄 Buffer size: ${pdfBuffer.length} bytes`);
    });
});