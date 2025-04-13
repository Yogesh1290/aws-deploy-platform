"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"

export default function DeployForm() {
  const [repoUrl, setRepoUrl] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentUrl, setDeploymentUrl] = useState("")
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!repoUrl) {
      setError("Please enter a GitHub repository URL")
      return
    }

    setIsDeploying(true)
    setLogs([])
    setError("")
    setDeploymentUrl("")

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Deployment failed")
      }

      const reader = response.body?.getReader()

      if (reader) {
        // Process the stream for real-time logs
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          // Convert the Uint8Array to a string
          const text = new TextDecoder().decode(value)

          try {
            // Try to parse as JSON
            const data = JSON.parse(text)

            if (data.type === "log") {
              setLogs((prev) => [...prev, data.message])
            } else if (data.type === "complete") {
              setDeploymentUrl(data.url)
              setIsDeploying(false)
            } else if (data.type === "error") {
              setError(data.message)
              setIsDeploying(false)
            }
          } catch (e) {
            // If not valid JSON, just add as log
            setLogs((prev) => [...prev, text])
          }
        }
      } else {
        // Fallback for browsers that don't support streaming
        const data = await response.json()
        setDeploymentUrl(data.url)
        setIsDeploying(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setIsDeploying(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-1">
            GitHub Repository URL
          </label>
          <Input
            id="repoUrl"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/username/repo"
            disabled={isDeploying}
            className="w-full"
          />
        </div>

        <Button type="submit" disabled={isDeploying} className="w-full">
          {isDeploying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deploying...
            </>
          ) : (
            "Deploy"
          )}
        </Button>
      </form>

      {logs.length > 0 && (
        <Card className="mt-6 p-4 bg-black text-white font-mono text-sm overflow-auto max-h-96">
          {logs.map((log, index) => (
            <div key={index} className="whitespace-pre-wrap">
              {log}
            </div>
          ))}
        </Card>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {deploymentUrl && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-700 font-medium">Deployment successful!</p>
              <p className="mt-1 text-sm text-gray-600">Your site is now available at:</p>
            </div>
          </div>
          <a
            href={deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block w-full p-2 bg-white border border-gray-300 rounded text-blue-600 hover:text-blue-800 truncate text-center"
          >
            {deploymentUrl}
          </a>
        </div>
      )}
    </div>
  )
}
