import DeployForm from "@/components/deploy-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AWS Deploy Platform",
  description: "Deploy your GitHub repositories to AWS S3 with a single click",
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">AWS Deploy Platform</h1>
            <p className="text-xl text-gray-600">Deploy your GitHub repositories to AWS S3 with a single click</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <DeployForm />
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-gray-500">
        <p>© {new Date().getFullYear()} AWS Deploy Platform</p>
      </footer>
    </div>
  )
}
