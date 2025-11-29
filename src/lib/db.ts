import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'database.sqlite');
const db = new Database(DB_PATH);

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        totp_secret TEXT,
        webauthn_credentials TEXT,
        current_challenge TEXT,
        disabled INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        authorize_url TEXT NOT NULL,
        token_url TEXT NOT NULL,
        scope TEXT,
        redirect_uri TEXT NOT NULL,
        end_session_endpoint TEXT,
        post_logout_redirect_uri TEXT,
        custom_attributes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS authenticators (
        credentialID TEXT PRIMARY KEY,
        credentialPublicKey TEXT NOT NULL,
        counter INTEGER NOT NULL,
        credentialDeviceType TEXT NOT NULL,
        credentialBackedUp INTEGER NOT NULL,
        transports TEXT,
        user_id TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

// Migrations
try {
    const clientColumns = db.prepare('PRAGMA table_info(clients)').all() as any[];
    const hasCustomAttributes = clientColumns.some(col => col.name === 'custom_attributes');
    if (!hasCustomAttributes) {
        db.exec('ALTER TABLE clients ADD COLUMN custom_attributes TEXT');
        console.log('Migrated clients table: added custom_attributes column');
    }

    const hasEndSessionEndpoint = clientColumns.some(col => col.name === 'end_session_endpoint');
    if (!hasEndSessionEndpoint) {
        db.exec('ALTER TABLE clients ADD COLUMN end_session_endpoint TEXT');
        console.log('Migrated clients table: added end_session_endpoint column');
    }

    const hasPostLogoutRedirectUri = clientColumns.some(col => col.name === 'post_logout_redirect_uri');
    if (!hasPostLogoutRedirectUri) {
        db.exec('ALTER TABLE clients ADD COLUMN post_logout_redirect_uri TEXT');
        console.log('Migrated clients table: added post_logout_redirect_uri column');
    }

    const userColumns = db.prepare('PRAGMA table_info(users)').all() as any[];
    const hasDisabled = userColumns.some(col => col.name === 'disabled');
    if (!hasDisabled) {
        db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0');
        console.log('Migrated users table: added disabled column');
    }
} catch (error) {
    console.error('Migration failed:', error);
}

export interface User {
    id: string;
    username: string;
    password_hash: string;
    totp_secret?: string;
    current_challenge?: string;
    disabled: boolean;
    created_at: string;
}

export interface Authenticator {
    credentialID: string;
    credentialPublicKey: string;
    counter: number;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
    transports?: string;
    user_id: string;
}

export interface Client {
    id: string;
    user_id: string;
    name: string;
    client_id: string;
    client_secret: string;
    authorize_url: string;
    token_url: string;
    scope?: string;
    redirect_uri: string;
    end_session_endpoint?: string;
    post_logout_redirect_uri?: string;
    custom_attributes?: string;
    created_at: string;
}

// Migration helper: Check if clients.json exists and migrate to DB
const CLIENTS_JSON_PATH = path.join(process.cwd(), 'clients.json');

export function migrateLegacyClients() {
    if (fs.existsSync(CLIENTS_JSON_PATH)) {
        try {
            const data = fs.readFileSync(CLIENTS_JSON_PATH, 'utf-8');
            const legacyClients = JSON.parse(data);

            if (legacyClients.length > 0) {
                // Create a default admin user if not exists
                let adminUser = getUserByUsername('admin');
                if (!adminUser) {
                    const hashedPassword = bcrypt.hashSync('admin', 10);
                    adminUser = createUser('admin', hashedPassword);
                    console.log('Created default admin user for migration');
                }

                const insertStmt = db.prepare(`
                    INSERT OR IGNORE INTO clients (id, user_id, name, client_id, client_secret, authorize_url, token_url, scope, redirect_uri, custom_attributes)
                    VALUES (@id, @user_id, @name, @clientId, @clientSecret, @authorizeUrl, @tokenUrl, @scope, @redirectUri, @customAttributes)
                `);

                const insertMany = db.transaction((clients) => {
                    for (const client of clients) {
                        insertStmt.run({
                            ...client,
                            user_id: adminUser!.id,
                            customAttributes: client.customAttributes ? JSON.stringify(client.customAttributes) : null
                        });
                    }
                });

                insertMany(legacyClients);
                console.log(`Migrated ${legacyClients.length} clients to database.`);

                // Rename clients.json to avoid re-migration
                fs.renameSync(CLIENTS_JSON_PATH, `${CLIENTS_JSON_PATH}.bak`);
            }
        } catch (e) {
            console.error('Failed to migrate legacy clients:', e);
        }
    }
}

// User functions
export function createUser(username: string, passwordHash: string): User {
    const id = uuidv4();
    const stmt = db.prepare('INSERT INTO users (id, username, password_hash, disabled) VALUES (?, ?, ?, 0)');
    stmt.run(id, username, passwordHash);
    return getUser(id)!;
}

export function getUser(id: string): User | undefined {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) return undefined;
    return { ...user, disabled: !!user.disabled };
}

export function getUserByUsername(username: string): User | undefined {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) return undefined;
    return { ...user, disabled: !!user.disabled };
}

export function getAllUsers(): (User & { clientCount: number })[] {
    const users = db.prepare(`
        SELECT u.*, COUNT(c.id) as clientCount 
        FROM users u 
        LEFT JOIN clients c ON u.id = c.user_id 
        GROUP BY u.id
    `).all() as any[];

    return users.map(u => ({
        ...u,
        disabled: !!u.disabled,
        clientCount: u.clientCount || 0
    }));
}

export function deleteUser(id: string) {
    // Due to ON DELETE CASCADE, clients and authenticators should be deleted automatically
    // But better-sqlite3 might not have foreign key constraints enabled by default in all environments
    // So let's enable them or do manual deletion just in case to be safe
    db.pragma('foreign_keys = ON');
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function updateUserPassword(id: string, passwordHash: string) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

export function updateUserStatus(id: string, disabled: boolean) {
    db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
}

export function updateUserTotpSecret(userId: string, secret: string | null) {
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, userId);
}

export function updateUserChallenge(userId: string, challenge: string | null) {
    // Check if column exists, if not add it (simple migration for now)
    try {
        db.prepare('UPDATE users SET current_challenge = ? WHERE id = ?').run(challenge, userId);
    } catch (e) {
        db.exec('ALTER TABLE users ADD COLUMN current_challenge TEXT');
        db.prepare('UPDATE users SET current_challenge = ? WHERE id = ?').run(challenge, userId);
    }
}

export function getUserAuthenticators(userId: string): Authenticator[] {
    const auths = db.prepare('SELECT * FROM authenticators WHERE user_id = ?').all(userId) as any[];
    return auths.map(a => ({
        ...a,
        credentialBackedUp: !!a.credentialBackedUp
    }));
}

export function saveAuthenticator(auth: Authenticator) {
    const stmt = db.prepare(`
        INSERT INTO authenticators (credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp, transports, user_id)
        VALUES (@credentialID, @credentialPublicKey, @counter, @credentialDeviceType, @credentialBackedUp, @transports, @user_id)
    `);
    stmt.run({
        ...auth,
        credentialBackedUp: auth.credentialBackedUp ? 1 : 0
    });
}

export function getAuthenticator(credentialID: string): Authenticator | undefined {
    const auth = db.prepare('SELECT * FROM authenticators WHERE credentialID = ?').get(credentialID) as any;
    if (!auth) return undefined;
    return {
        ...auth,
        credentialBackedUp: !!auth.credentialBackedUp
    };
}

export function updateAuthenticatorCounter(credentialID: string, counter: number) {
    db.prepare('UPDATE authenticators SET counter = ? WHERE credentialID = ?').run(counter, credentialID);
}

// Client functions
export function getClientsByUserId(userId: string): Client[] {
    return db.prepare('SELECT * FROM clients WHERE user_id = ?').all(userId) as Client[];
}

export function getClientById(id: string): Client | undefined {
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined;
}

export function createClient(client: Omit<Client, 'created_at'>) {
    const stmt = db.prepare(`
        INSERT INTO clients (id, user_id, name, client_id, client_secret, authorize_url, token_url, scope, redirect_uri, end_session_endpoint, post_logout_redirect_uri, custom_attributes)
        VALUES (@id, @user_id, @name, @client_id, @client_secret, @authorize_url, @token_url, @scope, @redirect_uri, @end_session_endpoint, @post_logout_redirect_uri, @custom_attributes)
    `);
    stmt.run(client);
}

export function updateClient(client: Client) {
    const stmt = db.prepare(`
        UPDATE clients SET 
            name = @name, 
            client_id = @client_id, 
            client_secret = @client_secret, 
            authorize_url = @authorize_url, 
            token_url = @token_url, 
            scope = @scope, 
            redirect_uri = @redirect_uri,
            end_session_endpoint = @end_session_endpoint,
            post_logout_redirect_uri = @post_logout_redirect_uri,
            custom_attributes = @custom_attributes
        WHERE id = @id AND user_id = @user_id
    `);
    stmt.run(client);
}

export function deleteClient(id: string, userId: string) {
    db.prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(id, userId);
}

export function adminDeleteClient(id: string) {
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
}

// Run migration on module load (safe because of checks)
migrateLegacyClients();

export default db;
