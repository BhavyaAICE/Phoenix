# Phoenix PowerShell Deployment Script
param (
    [string]$Target = "help",
    [string]$BackendUrl = "http://localhost:8000",
    [string]$FrontendUrl = "http://localhost:3000"
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "    Project Phoenix - Deployment      " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

switch ($Target.ToLower()) {
    "docker" {
        Write-Host "-> Deploying with Docker Compose..." -ForegroundColor Green
        docker compose up -d --build
        Write-Host "-> Stack running on http://localhost:3000 (frontend) and http://localhost:8000 (backend)" -ForegroundColor Green
    }
    "seed" {
        Write-Host "-> Seeding database with demo data..." -ForegroundColor Green
        npm run seed --prefix phoenix-backend
    }
    "seed:atlas" {
        Write-Host "-> Seeding MongoDB Atlas cluster..." -ForegroundColor Green
        $env:MONGODB_URI = "mongodb+srv://bhavyagupta_db_user:Qo4Q1Icci01t1a14@phoenix.hvm8u1f.mongodb.net/phoenix?retryWrites=true&w=majority"
        npm run seed --prefix phoenix-backend
    }
    "build" {
        Write-Host "-> Building backend and frontend..." -ForegroundColor Green
        npm run build --prefix phoenix-backend
        npm run build --prefix phoenix-frontend
        Write-Host "-> Both builds succeeded!" -ForegroundColor Green
    }
    default {
        Write-Host "Usage: .\deploy.ps1 -Target [docker | seed | seed:atlas | build]" -ForegroundColor Yellow
    }
}

