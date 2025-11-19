# OAuth Simulator

A powerful, modern web application designed to help developers test, debug, and understand OAuth 2.0 flows. This simulator provides a user-friendly interface to interact with OAuth providers, inspect tokens, and validate integration scenarios.

## Features

- **Multiple OAuth Flows**: Support for Authorization Code and Client Credentials flows.
- **Token Inspection**: View and decode Access Tokens, ID Tokens, and Refresh Tokens.
- **Client Management**: Configure and manage multiple OAuth clients easily.
- **Secure Access**: Protected by built-in authentication.
- **Modern UI**: Clean, responsive interface with Dark/Light mode support.

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Installation & Running

1.  Clone the repository.
2.  Start the application using Docker Compose:

    ```bash
    docker-compose up -d
    ```

3.  Open your browser and navigate to `http://localhost:3000`.

### Default Credentials

- **Username**: `admin` (or as configured in `docker-compose.yml`)
- **Password**: `admin` (or as configured in `docker-compose.yml`)

## Configuration

### Managing Clients

OAuth clients are configured in `clients.json`. The application expects a JSON array of client objects with the following structure:

```json
[
  {
    "id": "google",
    "name": "Google",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "authorizeUrl": "https://accounts.google.com/o/oauth2/v2/auth",
    "tokenUrl": "https://oauth2.googleapis.com/token",
    "scope": "openid profile email",
    "redirectUri": "http://localhost:3000/api/callback"
  }
]
```

You can also manage clients directly through the application UI.

### Environment Variables

The application uses the following environment variables (defined in `docker-compose.yml`):

- `APP_PASSWORD`: The password for the application login (default: `admin`).
- `NODE_ENV`: Node environment (default: `production`).

---

<p align="center">
  Built with ❤️ using <strong>Antigravity</strong> by Google DeepMind.
</p>
