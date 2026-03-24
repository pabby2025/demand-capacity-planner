#!/bin/bash
# ============================================================
# Azure Resource Provisioning — Demand Capacity Planner
# Run this ONCE in Azure Cloud Shell: https://shell.azure.com
# ============================================================
set -e

# ── Config ────────────────────────────────────────────────────
SUBSCRIPTION_ID="7b62dc90-3344-4868-9cd9-8f2a298eb856"
RESOURCE_GROUP="rg-demand-capacity-planner"
LOCATION="eastus"                        # Change if preferred

ACR_NAME="acrdemandcapacity"             # Must be globally unique, alphanumeric
APP_NAME="demand-capacity-planner"       # Must be globally unique → becomes URL
APP_SERVICE_PLAN="asp-demand-capacity"
POSTGRES_SERVER="psql-demand-capacity"   # Must be globally unique
POSTGRES_DB="capacityplanner"
POSTGRES_USER="capacityadmin"
# Auto-generate a secure password
POSTGRES_PASSWORD="Cap$(openssl rand -hex 8)Pl!"

GITHUB_REPO="pabby2025/demand-capacity-planner"

# ── Set subscription ──────────────────────────────────────────
echo ">>> Setting subscription..."
az account set --subscription "$SUBSCRIPTION_ID"

# ── Resource Group ────────────────────────────────────────────
echo ">>> Creating resource group: $RESOURCE_GROUP"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

# ── Azure Container Registry ──────────────────────────────────
echo ">>> Creating Container Registry: $ACR_NAME"
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none

ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# ── PostgreSQL Flexible Server ────────────────────────────────
echo ">>> Creating PostgreSQL server: $POSTGRES_SERVER (takes ~5 min)..."
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --location "$LOCATION" \
  --admin-user "$POSTGRES_USER" \
  --admin-password "$POSTGRES_PASSWORD" \
  --sku-name "Standard_B1ms" \
  --tier "Burstable" \
  --version "16" \
  --storage-size 32 \
  --public-access "0.0.0.0" \
  --output none

echo ">>> Creating database: $POSTGRES_DB"
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER" \
  --database-name "$POSTGRES_DB" \
  --output none

POSTGRES_HOST="${POSTGRES_SERVER}.postgres.database.azure.com"
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?sslmode=require"

# ── App Service ────────────────────────────────────────────────
echo ">>> Creating App Service Plan: $APP_SERVICE_PLAN"
az appservice plan create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_PLAN" \
  --is-linux \
  --sku B2 \
  --output none

echo ">>> Creating Web App: $APP_NAME"
az webapp create \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --name "$APP_NAME" \
  --deployment-container-image-name "${ACR_NAME}.azurecr.io/capacity-planner:latest" \
  --output none

# Configure ACR credentials on App Service
az webapp config container set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --docker-custom-image-name "${ACR_NAME}.azurecr.io/capacity-planner:latest" \
  --docker-registry-server-url "https://${ACR_NAME}.azurecr.io" \
  --docker-registry-server-user "$ACR_USERNAME" \
  --docker-registry-server-password "$ACR_PASSWORD" \
  --output none

# Configure environment variables
echo ">>> Configuring App Settings..."
az webapp config appsettings set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    DATABASE_URL="$DATABASE_URL" \
    WEBSITES_PORT="8000" \
    EXCEL_PATH="/app/backend/large_sample_dataset.xlsx" \
  --output none

# Enable container continuous deployment
az webapp deployment container config \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --enable-cd true \
  --output none

# ── Service Principal for GitHub Actions ──────────────────────
echo ""
echo ">>> Creating Service Principal for GitHub Actions..."
SP_JSON=$(az ad sp create-for-rbac \
  --name "sp-demand-capacity-gh" \
  --role contributor \
  --scopes "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
  --sdk-auth)

# ── Output ────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo "  SETUP COMPLETE"
echo "================================================================"
echo ""
echo "  App URL:        https://${APP_NAME}.azurewebsites.net"
echo "  PostgreSQL:     ${POSTGRES_HOST}"
echo "  ACR:            ${ACR_NAME}.azurecr.io"
echo ""
echo "  DB password:    ${POSTGRES_PASSWORD}"
echo "  (saved in App Service settings — you don't need to store this)"
echo ""
echo "================================================================"
echo "  GITHUB SECRET — Add this to your repo:"
echo "  Go to: https://github.com/${GITHUB_REPO}/settings/secrets/actions"
echo "  Add secret named:  AZURE_CREDENTIALS"
echo "  Value (copy everything between the lines below):"
echo "----------------------------------------------------------------"
echo "$SP_JSON"
echo "----------------------------------------------------------------"
echo ""
echo "  After adding the secret, push to 'main' to trigger deployment."
echo "================================================================"
