# OAuth Simulator Walkthrough

The OAuth Simulator is a modern web application designed to help you understand and debug OAuth 2.0 flows. It supports Authorization Code and Client Credentials flows, with a built-in token decoder.

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Or Node.js 18+ for local development

### Running with Docker
1. Build and start the container:
   ```bash
   docker-compose up -d --build
   ```
2. Open your browser to [http://localhost:3000](http://localhost:3000).
3. Login with the default password: `admin`.

### Running Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

## Features

### 1. Dashboard
- View all configured OAuth clients.
- Add new clients with custom endpoints and credentials.
- **Edit existing clients**: Update configuration for any client directly from the dashboard.
- Configuration is persisted to `clients.json` (or SQLite database).

### 2. Authorization Code Flow
- Simulate the user-interactive flow.
- Redirects to the provider's authorization URL.
- Captures the callback code and exchanges it for tokens.
- Displays the full token response.

### 3. Client Credentials Flow
- Simulate machine-to-machine authentication.
- Directly exchanges credentials for an access token.

### 4. Token Viewer
- Automatically decodes JWTs (Access/ID Tokens).
- Shows Header and Payload in a readable format.
- Displays raw token strings for copying.

## Configuration
- **App Password**: Set via `APP_PASSWORD` environment variable (default: `admin`).
- **Persistence**: Client data is stored in `data/database.sqlite` (mapped as a volume in Docker).
