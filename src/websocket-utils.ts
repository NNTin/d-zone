// Websocket utility functions for testing
import { gameLogger } from './gameLogger.js';
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
    
    gameLogger.debug('Server lookup for join message', {
        requestedServerId: server.id,
        foundServerData: serverData,
        allServers: gameState.servers
    });
    
    // Only send Discord OAuth token for passworded servers
    if (serverData && serverData.passworded && discordAuth && discordAuth.isLoggedIn()) {
        connectionMessage.data.discordToken = discordAuth.accessToken;
        connectionMessage.data.discordUser = discordAuth.getUser();
        gameLogger.debug('Including Discord OAuth data in join message', {
            tokenLength: discordAuth.accessToken ? discordAuth.accessToken.length : 0,
            username: discordAuth.getUser()?.username
        });
    } else {
        gameLogger.debug('Not including Discord OAuth data in join message', {
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