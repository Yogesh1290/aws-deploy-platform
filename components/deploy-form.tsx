"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"

export default function DeployForm() {
  const [repoUrl, setRepoUrl] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentUrl, setDeploymentUrl] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!repoUrl) {
      setError("Please enter a GitHub repository URL")
      return
    }

    setIsDeploying(true)
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

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Error parsing JSON response:", jsonError)
        throw new Error("Invalid response from server. Please try again.")
      }

      if (!response.ok) {
        throw new Error(data.error || "Deployment failed")
      }

      setDeploymentUrl(data.deploymentUrl)
      setIsDeploying(false)
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
              <p className="text-green-700 font-medium">Deployment initiated!</p>
              <p className="mt-1 text-sm text-gray-600">Your site will be available at:</p>
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
          <p className="mt-2 text-sm text-gray-500">
            Note: The actual deployment will happen in the background. The page will refresh automatically to show
            progress.
          </p>
        </div>
      )}
    </div>
  )
}
