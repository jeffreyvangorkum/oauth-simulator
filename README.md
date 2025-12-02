# OAuth Simulator

![OAuth Simulator Banner](oauth-simulator-banner.jpg)

A powerful, modern web application designed to help developers test, debug, and understand OAuth 2.0 flows. This simulator provides a user-friendly interface to interact with OAuth providers, inspect tokens, and validate integration scenarios.

## Features

- **Multiple OAuth Flows**: Support for Authorization Code and Client Credentials flows.
- **Token Inspection**: View and decode Access Tokens, ID Tokens, and Refresh Tokens.
- **JWT Signature Validation**: Verify token signatures using JWKS URLs with visual validation status.
- **Client Management**: Configure and manage multiple OAuth clients easily.
- **OIDC Discovery**: Auto-configure clients using OpenID Connect discovery URLs.
- **Custom Attributes**: Add custom query parameters to authorization requests.
- **Import/Export**: Export clients to JSON (with optional secrets) and import them back.
- **Refresh Token Flow**: Test token refresh functionality.
- **Logout Support**: End session endpoint integration for proper logout flows.
- **Secure Access**: Protected by built-in authentication with Multi-Factor Authentication (TOTP & WebAuthn).
- **Modern UI**: Clean, responsive interface with Dark/Light mode support.
- **Admin Panel**: Manage users and their clients (admin account only).

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

- `JWT_SECRET`: Secret key for signing session tokens. **Important**: Change this to a secure random value in production.
- `APP_URL`: The base URL of the application (default: `http://localhost:3000`). Used for autofilling Redirect URIs and Post Logout Redirect URIs.
- `ENABLE_REGISTRATION`: Set to `true` to allow new user registration, or `false` to disable it (default: `true`).
- `LOG_LEVEL`: Controls application logging verbosity. Available levels: `ERROR`, `WARN`, `INFO`, `DEBUG` (default: `INFO`). Set to `DEBUG` for detailed troubleshooting.
- `RP_ID`: Relying Party ID for WebAuthn (Passkey) authentication. Should match your domain (default: `localhost`).
- `RP_NAME`: Display name for WebAuthn authentication (default: `OAuth Simulator`).
- `RP_ORIGIN`: Origin URL for WebAuthn authentication. Must match the URL users access the app from (default: `http://localhost:3000`).
- `NODE_ENV`: Node environment (default: `production`).

---

<p align="center">
  Built with ❤️ using <strong>Antigravity</strong> by Google DeepMind.
</p>
