import { NextResponse } from "next/server"
import { S3 } from "aws-sdk"

export async function GET() {
  let s3Status = "unchecked"

  try {
    // Test S3 connection
    if (
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_KEY_ID &&
      process.env.AWS_REGION &&
      process.env.S3_BUCKET_NAME
    ) {
      const s3 = new S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_KEY_ID,
        region: process.env.AWS_REGION,
      })

      // Try to list objects in the bucket
      await s3
        .listObjectsV2({
          Bucket: process.env.S3_BUCKET_NAME,
          MaxKeys: 1,
        })
        .promise()

      s3Status = "connected"
    } else {
      s3Status = "missing credentials"
    }
  } catch (error) {
    s3Status = `error: ${error instanceof Error ? error.message : String(error)}`
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    aws: {
      region: process.env.AWS_REGION || "missing",
      s3Bucket: process.env.S3_BUCKET_NAME || "missing",
      s3Status,
      accessKeyConfigured: !!process.env.AWS_ACCESS_KEY_ID,
      secretKeyConfigured: !!process.env.AWS_SECRET_KEY_ID,
    },
  })
}
