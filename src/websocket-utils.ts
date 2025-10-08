// Websocket utility functions for testing
import { util } from './script/common/util.js';

export { util };

export interface ServerData {
    id: string;
    passworded: boolean;
    name?: string;
}

export interface GameState {
    servers?: Record<string, ServerData>;
    server?: string;
    pendingServerJoin?: ServerData;
}

export interface DiscordAuth {
    isLoggedIn(): boolean;
    accessToken?: string;
    getUser(): any;
}

export function createJoinServerMessage(
    server: { id: string }, 
    gameState: GameState, 
    discordAuth?: DiscordAuth
): any {
    const connectionMessage: any = { type: 'connect', data: { server: server.id } };
    
    // Find the server data by looking through all servers for matching ID
    let serverData = null;
    if (gameState.servers) {
        for (const discordId in gameState.servers) {
            if (gameState.servers.hasOwnProperty(discordId) && gameState.servers[discordId].id === server.id) {
                serverData = gameState.servers[discordId];
                break;
            }
        }
    }
    
    console.log('Server lookup result:', {
        requestedServerId: server.id,
        foundServerData: serverData,
        allServers: gameState.servers
    });
    
    // Only send Discord OAuth token for passworded servers
    if (serverData && serverData.passworded && discordAuth && discordAuth.isLoggedIn()) {
        connectionMessage.data.discordToken = discordAuth.accessToken;
        connectionMessage.data.discordUser = discordAuth.getUser();
        console.log('Sending Discord OAuth data:', {
            token: discordAuth.accessToken ? discordAuth.accessToken.substring(0, 10) + '...' : 'null',
            user: discordAuth.getUser()
        });
    } else {
        console.log('Not sending Discord OAuth data. Conditions:', {
            serverFound: !!serverData,
            serverPassworded: serverData ? serverData.passworded : 'unknown',
            discordAuthExists: !!discordAuth,
            discordLoggedIn: discordAuth ? discordAuth.isLoggedIn() : false
        });
    }
    
    return connectionMessage;
}

export function getStartupServer(): { id: string } {
    // Get startup server, first checking URL params, then localstorage
    let startupServer: any = { id: util.getURLParameter('s') }; // Check URL params
    if (!startupServer.id) {
        const stored = localStorage.getItem('dzone-default-server'); // Check localstorage
        if (stored) startupServer = JSON.parse(stored);
    }
    if (!startupServer.id/* || !game.servers[startupServer.id]*/) startupServer = { id: 'default' };
    // Remove password parameter support since we use Discord OAuth
    return startupServer;
}