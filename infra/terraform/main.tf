terraform {
  required_version = ">= 1.5"

  required_providers {
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.6"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "railway" {
  token = var.railway_token
}

# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

resource "railway_project" "simplenotes" {
  name        = "SimpleNotes"
  description = "Offline-first notes app: API + PWA + Postgres."
  private     = true
}

locals {
  environment_id = railway_project.simplenotes.default_environment.id
  database_url   = "postgresql://${var.db_user}:${random_password.db.result}@${var.pg_private_host}:5432/${var.db_name}"
}

# ---------------------------------------------------------------------------
# 1) PostgreSQL database (provisioned as a service from the Postgres image)
#    NOTE: the Railway provider has no dedicated "database" resource or a
#    per-service "plan" argument — databases are run as services, and the
#    plan (developer/hobby/pro) is an account-level setting.
# ---------------------------------------------------------------------------

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "railway_service" "postgres" {
  name         = "SimpleNotes-DB"
  project_id   = railway_project.simplenotes.id
  source_image = var.postgres_image

  volume = {
    name       = "pg-data"
    mount_path = "/var/lib/postgresql/data"
  }
}

resource "railway_variable" "pg_user" {
  name           = "POSTGRES_USER"
  value          = var.db_user
  environment_id = local.environment_id
  service_id     = railway_service.postgres.id
}

resource "railway_variable" "pg_password" {
  name           = "POSTGRES_PASSWORD"
  value          = random_password.db.result
  environment_id = local.environment_id
  service_id     = railway_service.postgres.id
}

resource "railway_variable" "pg_db" {
  name           = "POSTGRES_DB"
  value          = var.db_name
  environment_id = local.environment_id
  service_id     = railway_service.postgres.id
}

resource "railway_variable" "pg_pgdata" {
  name           = "PGDATA"
  value          = "/var/lib/postgresql/data/pgdata"
  environment_id = local.environment_id
  service_id     = railway_service.postgres.id
}

# ---------------------------------------------------------------------------
# 2) Backend API (Docker build from backend/ in the repo)
#    Railway auto-detects backend/Dockerfile from root_directory. The provider
#    has no "dockerfile_path" argument; root_directory + autodetect is the
#    equivalent.
# ---------------------------------------------------------------------------

resource "railway_service" "backend" {
  name               = "SimpleNotes-API"
  project_id         = railway_project.simplenotes.id
  source_repo        = var.github_repo
  source_repo_branch = var.github_branch
  root_directory     = "backend"
}

resource "railway_variable" "backend_database_url" {
  name           = "DATABASE_URL"
  value          = local.database_url
  environment_id = local.environment_id
  service_id     = railway_service.backend.id
}

resource "railway_variable" "backend_pythonunbuffered" {
  name           = "PYTHONUNBUFFERED"
  value          = "1"
  environment_id = local.environment_id
  service_id     = railway_service.backend.id
}

resource "railway_service_domain" "backend" {
  subdomain      = var.backend_subdomain
  environment_id = local.environment_id
  service_id     = railway_service.backend.id
}

# ---------------------------------------------------------------------------
# 3) PWA (Vite build from pwa/ in the repo via pwa/Dockerfile)
#    VITE_API_URL must be present at BUILD time; Railway injects service
#    variables during the build, so setting it here is sufficient.
# ---------------------------------------------------------------------------

resource "railway_service" "pwa" {
  name               = "SimpleNotes-PWA"
  project_id         = railway_project.simplenotes.id
  source_repo        = var.github_repo
  source_repo_branch = var.github_branch
  root_directory     = "pwa"
}

resource "railway_variable" "pwa_api_url" {
  name           = "VITE_API_URL"
  value          = "https://${railway_service_domain.backend.domain}"
  environment_id = local.environment_id
  service_id     = railway_service.pwa.id
}

resource "railway_service_domain" "pwa" {
  subdomain      = var.pwa_subdomain
  environment_id = local.environment_id
  service_id     = railway_service.pwa.id
}
