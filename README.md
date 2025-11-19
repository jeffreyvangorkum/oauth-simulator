# OAuth Simulator

A powerful, modern web application designed to help developers test, debug, and understand OAuth 2.0 flows. This simulator provides a user-friendly interface to interact with OAuth providers, inspect tokens, and validate integration scenarios.

## Features

- **Multiple OAuth Flows**: Support for Authorization Code and Client Credentials flows.
- **Token Inspection**: View and decode Access Tokens, ID Tokens, and Refresh Tokens.
- **Client Management**: Configure and manage multiple OAuth clients easily.
- **OIDC Discovery**: Auto-configure clients using OpenID Connect discovery URLs.
- **Secure Access**: Protected by built-in authentication with Multi-Factor Authentication (TOTP & WebAuthn).
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

### Authentication

- **Registration**: Create a new account on the registration page.
- **Login**: Log in with your username and password.
- **MFA**: Enable TOTP or WebAuthn (Passkeys) in the Settings page for enhanced security.

## Configuration

### Environment Variables

The application uses the following environment variables (defined in `docker-compose.yml`):

- `JWT_SECRET`: Secret key for signing session tokens (change this in production).
- `APP_URL`: The base URL of the application (default: `http://localhost:3000`). Used for autofilling Redirect URIs.
- `NODE_ENV`: Node environment (default: `production`).

### Migrating Legacy Clients

If you have an existing `clients.json` file, you can mount it to `/app/clients.json` in `docker-compose.yml` for a one-time migration.
The application will import these clients into the database and create a default `admin` user (password: `admin`) if no users exist.
After migration, the file is renamed to `clients.json.bak` and is no longer used.

---

<p align="center">
  Built with ❤️ using <strong>Antigravity</strong> by Google DeepMind.
</p>
