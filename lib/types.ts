export interface DeploymentLog {
  timestamp: string
  message: string
}

export interface DeploymentResult {
  projectId: string
  repoUrl: string
  deploymentUrl: string
  status: "success" | "failed"
  logs: DeploymentLog[]
  createdAt: string
}
