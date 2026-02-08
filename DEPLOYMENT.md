# BMW Forum - Deployment Guide

This guide describes how to deploy the BMW Forum application to Cloudflare Pages.

## Prerequisites

1.  **Node.js**: Ensure Node.js (v18+) is installed.
2.  **Wrangler**: Cloudflare's CLI tool (`npm install -g wrangler`).
3.  **Cloudflare Account**: You need a Cloudflare account.

## 1. Initial Setup

Install dependencies:
```bash
npm install
```

Login to Cloudflare:
```bash
npx wrangler login
```

## 2. Database Setup (D1)

The application uses Cloudflare D1 (SQLite) for the database.

### Create Database
If you haven't created the database yet defined in `wrangler.toml`:
```bash
npx wrangler d1 create bimmercode-db
```
*Update `wrangler.toml` with the `database_id` returned from this command.*

### Apply Schema
Apply the database structure:
```bash
npx wrangler d1 execute bimmercode-db --file=schema.sql
```

### Seed Initial Data
Populate the database with Roles, Permissions, User Levels, and a default Admin user:
```bash
npx wrangler d1 execute bimmercode-db --file=seed_prod.sql
```

> **Note:** The default admin credentials are:
> - **Username:** `admin`
> - **Password:** `Sup3rPassword!`
>
> **⚠️ IMPORTANT: Log in and change this password immediately after deployment.**

## 3. Configuration

### Secrets
Set the JWT Secret for production:
```bash
npx wrangler pages secret put JWT_SECRET
```
*Enter a strong random string when prompted.*

## 4. Deployment

Deploy the frontend and functions to Cloudflare Pages:
```bash
npx wrangler pages deploy .
```

## 5. Post-Deployment Checks

1.  Visit your deployment URL (e.g., `https://bimmercode.pages.dev`).
2.  Log in with the default admin credentials.
3.  Go to **Profile > Settings** and change your password.
4.  Navigate to `/admin.html` to verify admin access.

## Local Development
To run the app locally with a persistent local database:
```bash
npx wrangler pages dev . --persist-to=./.wrangler/state/v3/d1
```
