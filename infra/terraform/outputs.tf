output "database_url" {
  description = "Internal PostgreSQL connection string."
  value       = local.database_url
  sensitive   = true
}

output "backend_url" {
  description = "Public URL of the SimpleNotes API."
  value       = "https://${railway_service_domain.backend.domain}"
}

output "pwa_url" {
  description = "Public URL of the SimpleNotes PWA."
  value       = "https://${railway_service_domain.pwa.domain}"
}
