import { NextResponse } from "next/server"
import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import { marked } from "marked"
import fs from "fs/promises"
import path from "path"

export async function POST(request: Request) {
  try {
    const { markdown } = await request.json()

    if (!markdown) {
      return NextResponse.json({ error: "Markdown content is required" }, { status: 400 })
    }

    console.log("Generating PDF with puppeteer-core and @sparticuz/chromium")

    // Convert markdown to HTML
    const htmlContent = marked(markdown)

    // Construct the full HTML document with styles
    const logoPath = path.join(process.cwd(), "public", "aylelogo.png")
    const logoBuffer = await fs.readFile(logoPath)
    const logoBase64 = logoBuffer.toString("base64")
    const logoSrc = `data:image/png;base64,${logoBase64}`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Chat Export</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;700&family=Syne:wght@400;700&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
          <style>
            body {
              font-family: 'Geist', sans-serif;
              font-size: 16px;
              line-height: 1.6;
              color: #333;
              padding: 0;
              background-color: #fff;
            }
            .main-content {
              padding: 40px;
            }
            .logo-header {
              padding: 40px 40px 0;
            }
            .logo-header img {
              height: 48px;
            }
            h1 {
              font-family: 'Syne', sans-serif;
              font-size: 2.5em;
              font-weight: 700;
              margin-bottom: 1em;
              line-height: 1.2;
            }
            h2, h3, h4, h5, h6 {
              font-family: 'Geist', sans-serif;
              font-weight: 700;
              color: #222;
              margin-top: 1.5em;
              margin-bottom: 0.5em;
            }
            strong {
              font-weight: 700;
            }
            p {
              margin-bottom: 1em;
            }
            a {
              color: #1a0dab;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            hr {
              border: 0;
              border-top: 1px solid #ddd;
              margin: 2em 0;
            }
            pre {
              background-color: #2d2d2d;
              color: #f8f8f2;
              padding: 1em;
              border-radius: 5px;
              overflow-x: auto;
            }
            code {
              font-family: 'Courier New', Courier, monospace;
              background-color: #f0f0f0;
              padding: 0.2em 0.4em;
              border-radius: 3px;
            }
            pre > code {
              background-color: transparent;
              padding: 0;
              border-radius: 0;
            }
            blockquote {
              border-left: 4px solid #ddd;
              padding-left: 1em;
              margin-left: 0;
              color: #666;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1em;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
            }
          </style>
        </head>
        <body>
          <div class="logo-header">
            <img src="${logoSrc}" alt="Ayle Logo" />
          </div>
          <div class="main-content">
            ${htmlContent}
          </div>
        </body>
      </html>
    `

    let browser
    let executablePath
    let browserArgs: string[] = []

    try {
      const logoPath = path.join(process.cwd(), "public", "aylelogo.png")
      const logoBuffer = await fs.readFile(logoPath)
      const logoBase64 = logoBuffer.toString("base64")
      const logoSrc = `data:image/png;base64,${logoBase64}`

      const footerTemplate = `
        <div style="width: 100%; font-size: 10px; padding: 0 40px; box-sizing: border-box; display: flex; align-items: center;">
          <a href="https://ayle.chat" style="text-decoration: none; color: #333;">
            <img src="${logoSrc}" style="height: 20px;" />
          </a>
        </div>
      `

      // Configure browser based on environment
      if (process.env.NODE_ENV === "development") {
        // For local development
        const puppeteerPkg = await import('puppeteer')
        executablePath = puppeteerPkg.executablePath()
      } else {
        // For Vercel production (AWS Lambda)
        executablePath = await chromium.executablePath()
        browserArgs = [
          ...chromium.args,
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-first-run",
          "--no-sandbox",
          "--no-zygote",
          "--single-process",
        ]
      }

      console.log(`Using Chromium executable at: ${executablePath}`)

      browser = await puppeteer.launch({
        args: browserArgs,
        executablePath: executablePath,
        headless: true,
        defaultViewport: {
          width: 1280,
          height: 720,
          deviceScaleFactor: 1,
        },
      })

      const page = await browser.newPage()

      // Use setContent instead of goto for local HTML
      await page.setContent(html, { waitUntil: "networkidle0" })

      // To reflect CSS used for screens instead of print
      await page.emulateMediaType("screen")

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>", // Empty header to maintain top margin
        footerTemplate: footerTemplate,
        margin: {
          top: "100px",
          right: "20px",
          bottom: "100px",
          left: "20px",
        },
      })

      console.log("PDF generated successfully.")

      return new NextResponse(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="chat-export.pdf"`,
        },
      })
    } catch (error) {
      console.error("Error during Puppeteer PDF generation:", error)
      return NextResponse.json({ error: "Failed to generate PDF with Puppeteer" }, { status: 500 })
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
} 