import { type NextRequest, NextResponse } from "next/server"
import { S3 } from "aws-sdk"
import { v4 as uuidv4 } from "uuid"

// Configure AWS SDK
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
})

export async function POST(request: NextRequest) {
  const { repoUrl } = await request.json()

  // Validate input
  if (!repoUrl) {
    return NextResponse.json({ error: "Repository URL is required" }, { status: 400 })
  }

  // Validate that the URL is a GitHub repository
  const githubRegex = /^https:\/\/github\.com\/[^/]+\/[^/]+$/
  if (!githubRegex.test(repoUrl)) {
    return NextResponse.json(
      {
        error: "Invalid GitHub repository URL. Format should be: https://github.com/username/repo",
      },
      { status: 400 },
    )
  }

  try {
    // Generate a unique project ID
    const projectId = uuidv4()

    // Parse GitHub repository URL to get owner and repo
    const urlParts = repoUrl.split("/")
    const owner = urlParts[urlParts.length - 2]
    const repo = urlParts[urlParts.length - 1]

    // Create a deployment record in S3
    const deploymentRecord = {
      id: projectId,
      repoUrl,
      owner,
      repo,
      status: "queued",
      createdAt: new Date().toISOString(),
    }

    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: `deployments/${projectId}/metadata.json`,
        Body: JSON.stringify(deploymentRecord),
        ContentType: "application/json",
        ACL: "public-read",
      })
      .promise()

    // Create a placeholder index.html
    const placeholderHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Deployment in Progress</title>
        <meta http-equiv="refresh" content="30">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; }
          .container { text-align: center; margin-top: 50px; }
          .spinner { display: inline-block; width: 50px; height: 50px; border: 3px solid rgba(0, 0, 0, 0.1); border-radius: 50%; border-top-color: #000; animation: spin 1s ease-in-out infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h1>Deployment in Progress</h1>
          <p>Your site is being built and deployed. This page will automatically refresh.</p>
          <p>Project ID: ${projectId}</p>
          <p>Repository: ${repoUrl}</p>
        </div>
      </body>
    </html>
    `

    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: `${projectId}/index.html`,
        Body: placeholderHtml,
        ContentType: "text/html",
        ACL: "public-read",
      })
      .promise()

    // Generate the deployment URL
    const deploymentUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${projectId}/index.html`

    // Return the deployment URL immediately
    return NextResponse.json({
      projectId,
      deploymentUrl,
      status: "queued",
      message: "Deployment has been queued. Check the URL for status updates.",
    })
  } catch (error) {
    console.error("Error initiating deployment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}
