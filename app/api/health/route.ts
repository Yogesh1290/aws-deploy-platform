import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    aws: {
      region: process.env.AWS_REGION ? "configured" : "missing",
      s3Bucket: process.env.S3_BUCKET_NAME ? "configured" : "missing",
    },
  })
}
