# PRAGATI-AI — IPMPRS

Police proposal management, precedent retrieval, approval workflows, implementation tracking, and auditability.

## Source
This repository contains the application source synchronized from the PRAGATI-AI Hatchable project, including API endpoints, public UI assets, SQL migrations, and demo seed data.

## Project structure
- `api/` — authenticated API endpoints and workflows
- `public/` — login page, application UI, styles, and Puducherry sunrise logos
- `lib/` — shared application code
- `migrations/` — ordered database schema and feature migrations
- `seed.sql` — illustrative demo proposals and audit events
- `hatchable.toml` — Hatchable application configuration (secret values are not included)

## Deployment
The app is hosted on Hatchable. Configure the required `NVIDIA_API_KEY` secret in the deployment environment before enabling NVIDIA-powered features. Never commit API keys, database URLs, `.env` files, or real user credentials.
