import simpleGit from "simple-git"
import { exec } from "child_process"
import fs from "fs-extra"
import path from "path"
import { S3 } from "aws-sdk"
import { v4 as uuidv4 } from "uuid"
import { promisify } from "util"

const execPromise = promisify(exec)

// Configure AWS SDK
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
})

const TEMP_DIR = path.join(process.cwd(), "tmp")

interface DeployCallbacks {
  onLog: (message: string) => void
  onComplete: (url: string) => void
  onError: (error: string) => void
}

export async function deploy(repoUrl: string, callbacks: DeployCallbacks) {
  const { onLog, onComplete, onError } = callbacks

  // Generate a unique project ID
  const projectId = uuidv4()
  const projectDir = path.join(TEMP_DIR, projectId)

  try {
    // Ensure temp directory exists
    await fs.ensureDir(TEMP_DIR)

    onLog(`🚀 Starting deployment for ${repoUrl}`)
    onLog(`📁 Creating project directory: ${projectId}`)

    // Clone the repository
    onLog(`📥 Cloning repository: ${repoUrl}`)
    const git = simpleGit()
    await git.clone(repoUrl, projectDir)
    onLog("✅ Repository cloned successfully")

    // Install dependencies
    onLog("📦 Installing dependencies...")
    await execWithLogs("npm install", projectDir, onLog)
    onLog("✅ Dependencies installed successfully")

    // Build the project
    onLog("🔨 Building project...")
    await execWithLogs("npm run build", projectDir, onLog)
    onLog("✅ Project built successfully")

    // Check if the project has an export script
    const packageJsonPath = path.join(projectDir, "package.json")
    const packageJson = await fs.readJson(packageJsonPath)

    let outputDir = path.join(projectDir, "out")

    if (packageJson.scripts && packageJson.scripts.export) {
      // Run export if available
      onLog("📤 Exporting static files...")
      await execWithLogs("npm run export", projectDir, onLog)
      onLog("✅ Static files exported successfully")
    } else {
      // Check if this is a Next.js project with the App Router
      const nextConfigPath = path.join(projectDir, "next.config.js")
      const nextConfigMjsPath = path.join(projectDir, "next.config.mjs")

      if ((await fs.pathExists(nextConfigPath)) || (await fs.pathExists(nextConfigMjsPath))) {
        onLog("📝 Detected Next.js project")

        // For Next.js App Router, the output is in .next/standalone and .next/static
        const standaloneDir = path.join(projectDir, ".next", "standalone")
        const staticDir = path.join(projectDir, ".next", "static")

        if (await fs.pathExists(standaloneDir)) {
          onLog("📝 Detected Next.js standalone output")
          outputDir = standaloneDir

          // Copy static files to the public directory in the standalone output
          if (await fs.pathExists(staticDir)) {
            const publicDir = path.join(standaloneDir, "public")
            await fs.ensureDir(publicDir)
            await fs.copy(staticDir, path.join(publicDir, "_next", "static"))
          }
        } else {
          // For older Next.js projects or those without standalone output
          outputDir = path.join(projectDir, ".next")
        }
      } else {
        // For non-Next.js projects, check for common build output directories
        const buildDir = path.join(projectDir, "build")
        const distDir = path.join(projectDir, "dist")

        if (await fs.pathExists(buildDir)) {
          outputDir = buildDir
        } else if (await fs.pathExists(distDir)) {
          outputDir = distDir
        }
      }
    }

    // Check if the output directory exists
    if (!(await fs.pathExists(outputDir))) {
      throw new Error(`Output directory not found: ${outputDir}`)
    }

    // Upload to S3
    onLog(`📤 Uploading files to S3 bucket: ${process.env.S3_BUCKET_NAME}`)
    await uploadDirectoryToS3(outputDir, projectId, onLog)
    onLog("✅ Files uploaded successfully")

    // Generate the deployment URL
    const deploymentUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${projectId}/index.html`
    onLog(`🎉 Deployment complete! Your site is available at: ${deploymentUrl}`)

    // Clean up
    onLog("🧹 Cleaning up temporary files...")
    await fs.remove(projectDir)
    onLog("✅ Cleanup complete")

    onComplete(deploymentUrl)
  } catch (error) {
    console.error("Deployment error:", error)
    onError(error instanceof Error ? error.message : "An unknown error occurred")

    // Clean up on error
    try {
      if (await fs.pathExists(projectDir)) {
        await fs.remove(projectDir)
      }
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError)
    }
  }
}

async function execWithLogs(command: string, cwd: string, onLog: (message: string) => void): Promise<void> {
  onLog(`$ ${command}`)

  try {
    const { stdout, stderr } = await execPromise(command, { cwd })

    if (stdout) {
      onLog(stdout)
    }

    if (stderr) {
      onLog(`stderr: ${stderr}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      onLog(`Error: ${error.message}`)
      throw error
    }
    throw error
  }
}

async function uploadDirectoryToS3(
  directory: string,
  projectId: string,
  onLog: (message: string) => void,
): Promise<void> {
  const files = await getAllFiles(directory)

  for (const file of files) {
    const fileContent = await fs.readFile(file)
    const relativeFilePath = path.relative(directory, file)
    const s3Key = `${projectId}/${relativeFilePath.replace(/\\/g, "/")}`

    const params = {
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
      Body: fileContent,
      ContentType: getContentType(file),
      ACL: "public-read",
    }

    onLog(`Uploading: ${relativeFilePath}`)
    await s3.upload(params).promise()
  }
}

async function getAllFiles(directory: string): Promise<string[]> {
  const files: string[] = []

  async function getFilesRecursively(dir: string) {
    const items = await fs.readdir(dir)

    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = await fs.stat(fullPath)

      if (stat.isDirectory()) {
        await getFilesRecursively(fullPath)
      } else {
        files.push(fullPath)
      }
    }
  }

  await getFilesRecursively(directory)
  return files
}

function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()

  const contentTypeMap: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  }

  return contentTypeMap[extension] || "application/octet-stream"
}
