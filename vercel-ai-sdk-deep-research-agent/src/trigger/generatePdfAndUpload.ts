import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { task } from "@trigger.dev/sdk";
import libreoffice from "libreoffice-convert";
import { promisify } from "node:util";

const convert = promisify(libreoffice.convert);

// Initialize S3 client
const s3Client = new S3Client({
  // How to authenticate to R2: https://developers.cloudflare.com/r2/api/s3/tokens/
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const generatePdfAndUpload = task({
  id: "generate-pdf-and-upload",
  run: async (
    payload: { report: string; title?: string; name?: string },
    { ctx },
  ) => {
    // Set LibreOffice path for production environment
    if (ctx.environment.type !== "DEVELOPMENT") {
      process.env.LIBREOFFICE_PATH = "/usr/bin/libreoffice";
    }

    try {
      // Create a complete HTML document with styling
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${payload.title || "Research Report"}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 40px; 
            line-height: 1.6; 
            color: #333;
        }
        h1, h2, h3, h4 { color: #2c3e50; margin-top: 30px; }
        h1 { border-bottom: 3px solid #3498db; padding-bottom: 15px; font-size: 2.2em; }
        h2 { border-bottom: 1px solid #bdc3c7; padding-bottom: 10px; font-size: 1.8em; }
        h3 { font-size: 1.4em; }
        p { margin-bottom: 15px; }
        ul, ol { margin-left: 20px; margin-bottom: 15px; }
        li { margin-bottom: 8px; }
        blockquote { 
            border-left: 4px solid #3498db; 
            margin: 20px 0; 
            padding-left: 20px; 
            background-color: #f8f9fa;
            padding: 15px 20px;
            font-style: italic; 
        }
        strong { color: #2c3e50; }
        em { color: #7f8c8d; }
        a { color: #3498db; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 20px 0; 
            border: 1px solid #bdc3c7;
        }
        th, td { 
            border: 1px solid #bdc3c7; 
            padding: 12px; 
            text-align: left; 
        }
        th { 
            background-color: #ecf0f1; 
            font-weight: bold;
            color: #2c3e50;
        }
        .date { color: #7f8c8d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="date">Generated on ${new Date().toLocaleDateString()}</div>
    ${payload.report}
</body>
</html>`;

      // Convert HTML to PDF using LibreOffice
      const pdfBuffer = await convert(
        Buffer.from(htmlContent),
        ".pdf",
        undefined,
      );

      // Upload to R2
      const key = `${payload.name}.pdf`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: key,
          Body: pdfBuffer,
          ContentType: "application/pdf",
        }),
      );

      const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

      return {
        key,
        title: payload.title || "Research Report",
        pdfLocation: publicUrl,
      };
    } catch (error) {
      console.error("Error converting PDF:", error);
      throw error;
    }
  },
});
