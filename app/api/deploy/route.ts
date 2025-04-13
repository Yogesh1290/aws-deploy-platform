import { type NextRequest, NextResponse } from "next/server"
import { deploy } from "@/lib/deploy"

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

  // Create a stream for real-time logs
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Start the deployment process
  deploy(repoUrl, {
    onLog: (message) => {
      writer.write(encoder.encode(JSON.stringify({ type: "log", message }) + "\n"))
    },
    onComplete: (url) => {
      writer.write(encoder.encode(JSON.stringify({ type: "complete", url }) + "\n"))
      writer.close()
    },
    onError: (error) => {
      writer.write(encoder.encode(JSON.stringify({ type: "error", message: error }) + "\n"))
      writer.close()
    },
  })

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
