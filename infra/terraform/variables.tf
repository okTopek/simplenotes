variable "railway_token" {
  description = "Railway account/project token. Can also be set via RAILWAY_TOKEN env var."
  type        = string
  sensitive   = true
  default     = null
}

variable "github_repo" {
  description = "GitHub repository URL connected to Railway (e.g. https://github.com/you/simplenotes)."
  type        = string
}

variable "github_branch" {
  description = "Branch Railway deploys from."
  type        = string
  default     = "main"
}

variable "postgres_image" {
  description = "Container image used for the PostgreSQL service."
  type        = string
  default     = "ghcr.io/railwayapp-templates/postgres-ssl:16"
}

variable "db_user" {
  description = "PostgreSQL user."
  type        = string
  default     = "simplenotes"
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "simplenotes"
}

variable "pg_private_host" {
  description = "Private hostname of the Postgres service for intra-project networking (<slugified-service-name>.railway.internal)."
  type        = string
  default     = "simplenotes-db.railway.internal"
}

variable "backend_subdomain" {
  description = "Globally-unique subdomain for the API (xxx.up.railway.app)."
  type        = string
  default     = "simplenotes-api"
}

variable "pwa_subdomain" {
  description = "Globally-unique subdomain for the PWA (xxx.up.railway.app)."
  type        = string
  default     = "simplenotes-pwa"
}
