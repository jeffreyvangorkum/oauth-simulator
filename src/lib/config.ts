import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

const CONFIG_FILE = path.join(process.cwd(), 'clients.json');

export const OAuthClientSchema = z.object({
    id: z.string(),
    name: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
    authorizeUrl: z.string().url(),
    tokenUrl: z.string().url(),
    scope: z.string().optional(),
    redirectUri: z.string().url(),
});

export type OAuthClient = z.infer<typeof OAuthClientSchema>;

export async function getClients(): Promise<OAuthClient[]> {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, return empty array
        return [];
    }
}

export async function saveClient(client: OAuthClient): Promise<void> {
    const clients = await getClients();
    const existingIndex = clients.findIndex((c) => c.id === client.id);

    if (existingIndex >= 0) {
        clients[existingIndex] = client;
    } else {
        clients.push(client);
    }

    await fs.writeFile(CONFIG_FILE, JSON.stringify(clients, null, 2));
}

export async function deleteClient(id: string): Promise<void> {
    const clients = await getClients();
    const newClients = clients.filter((c) => c.id !== id);
    await fs.writeFile(CONFIG_FILE, JSON.stringify(newClients, null, 2));
}

export async function getClient(id: string): Promise<OAuthClient | undefined> {
    const clients = await getClients();
    return clients.find((c) => c.id === id);
}
