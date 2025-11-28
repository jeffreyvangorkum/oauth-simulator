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
        custom_attributes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS authenticators (
        credentialID TEXT PRIMARY KEY,
        credentialPublicKey TEXT NOT NULL,
        counter INTEGER NOT NULL,
        credentialDeviceType TEXT NOT NULL,
        credentialBackedUp INTEGER NOT NULL,
        transports TEXT,
        user_id TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
`);

// Migrations
try {
    const columns = db.prepare('PRAGMA table_info(clients)').all() as any[];
    const hasCustomAttributes = columns.some(col => col.name === 'custom_attributes');
    if (!hasCustomAttributes) {
        db.exec('ALTER TABLE clients ADD COLUMN custom_attributes TEXT');
        console.log('Migrated clients table: added custom_attributes column');
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
    const stmt = db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
    stmt.run(id, username, passwordHash);
    return getUser(id)!;
}

export function getUser(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByUsername(username: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
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
        INSERT INTO clients (id, user_id, name, client_id, client_secret, authorize_url, token_url, scope, redirect_uri, custom_attributes)
        VALUES (@id, @user_id, @name, @client_id, @client_secret, @authorize_url, @token_url, @scope, @redirect_uri, @custom_attributes)
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
            custom_attributes = @custom_attributes
        WHERE id = @id AND user_id = @user_id
    `);
    stmt.run(client);
}

export function deleteClient(id: string, userId: string) {
    db.prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(id, userId);
}

// Run migration on module load (safe because of checks)
migrateLegacyClients();

export default db;
