'use strict';

import { gameLogger } from './gameLogger.js';
import Users from './script/actors/users.js';
import DiscordOAuth from './script/auth/discord-oauth.js';
import { util } from './script/common/util.js';
import Canvas from './script/engine/canvas.js';
import Game from './script/engine/game.js';
import Preloader from './script/engine/preloader.js';
import Renderer from './script/engine/renderer.js';
import World from './script/environment/world.js';
import Decorator from './script/props/decorator.js';
import UI from './script/ui/ui.js';

// Import package.json for version information
// @ts-ignore - esbuild will handle this
import packageInfo from '../package.json';

// Global variables
let version: string;
let preloader: Preloader;
let game: Game;
let ws: WebSocket;
let discordAuth: DiscordOAuth;

// Export for testing
export { discordAuth, game, ws };

function initGame(images: Record<string, HTMLCanvasElement>): void {
    // Use direct imports since these modules will be available  
    // We'll fix these imports after converting the JS files to TS
    gameLogger.info('Initializing game with images', { imageCount: Object.keys(images).length, imageNames: Object.keys(images) });
    
    game = new Game({ step: 1000 / 60 });
    game.renderer = new Renderer({ game: game, images: images });
    const canvas = new Canvas({ id: 'main', game: game, initialScale: 2, backgroundColor: '#181213' });
    game.renderer.addCanvas(canvas);
    game.bindCanvas(canvas);
    
    // Initialize UI (converted to TypeScript)
    game.ui = new UI(game as any);
    
    //game.showGrid = true;
    //game.timeRenders = true;
    
    // Initialize Discord OAuth
    initDiscordAuth();
    
    // Add help button immediately after UI initialization
    addHelpButton();
    
    // Ensure UI is properly sized after adding the help button
    game.renderer.canvases[0].onResize();
    
    initWebsocket();

    (window as any).pause = function() { game.paused = true; };
    (window as any).unpause = function() { game.paused = false; };
    (window as any).game = game;
    
    // Set up initial draw logging
    let initialDrawLogged = false;
    game.on('render', () => {
        if (!initialDrawLogged) {
            initialDrawLogged = true;
            gameLogger.initialDraw();
        }
    });
    
    // Log game initialization complete
    gameLogger.gameInitialized({ 
        width: canvas.width, 
        height: canvas.height, 
        version: packageInfo.version 
    });
}

function reinitializeDiscordAuth(newClientId: string): void {
    gameLogger.info('Reinitializing Discord OAuth with new client ID', { newClientId });
    
    // Store the current state
    const wasLoggedIn = discordAuth && discordAuth.isLoggedIn();
    const currentUser = discordAuth ? discordAuth.getUser() : null;
    
    // Create new Discord OAuth instance with updated client ID
    const redirectUri = window.location.origin + window.location.pathname.replace('index.html', '') + 'discord-callback.html';
    
    discordAuth = new DiscordOAuth({
        clientId: newClientId,
        redirectUri: redirectUri,
        scopes: ['identify']
    });
    
    // Re-add event handlers
    setupDiscordAuthEventHandlers();
    
    // If user was logged in before, they might need to re-authenticate
    // since the client ID changed, but we'll preserve the current state for now
    if (wasLoggedIn && currentUser) {
        gameLogger.warn('Discord OAuth client ID updated - user may need to re-authenticate', { 
            currentUser: currentUser?.username 
        });
        // The stored access token may not work with the new client ID
        // but we'll let the user discover this naturally rather than forcing re-auth
    }
    
    gameLogger.info('Discord OAuth reinitialized successfully');
}

function setupDiscordAuthEventHandlers(): void {
    // Add debug logging to the login method
    const originalLogin = discordAuth.login;
    discordAuth.login = function() {
        const authUrl = this.getAuthUrl();
        gameLogger.debug('Discord OAuth URL generated', { authUrl });
        gameLogger.discordLoginAttempt();
        return originalLogin.call(this);
    };
    
    discordAuth.on('login-success', function(user) {
        gameLogger.discordLoginSuccess(user.username);
        // Store user info
        localStorage.setItem('discord_user', JSON.stringify(user));
        
        // If user was trying to join a server, try again now that they're authenticated
        if (game.pendingServerJoin) {
            joinServer(game.pendingServerJoin);
            delete game.pendingServerJoin;
        }
        
        // Update help panel if it's open
        if (game.helpPanel) {
            game.helpPanel.remove();
            delete game.helpPanel;
            // Reopen help panel to show updated login status
            setTimeout(function() {
                if (game.helpButton && game.helpButton.onPress) {
                    game.helpButton.onPress();
                }
            }, 100);
        }
    });
    
    discordAuth.on('login-error', function(error) {
        gameLogger.discordLoginError(error);
        (window as any).alert('Discord login failed: ' + error);
    });
    
    discordAuth.on('login-cancelled', function() {
        gameLogger.info('Discord login cancelled by user');
    });
    
    discordAuth.on('logout', function() {
        gameLogger.discordLogout();
        
        // Update help panel if it's open
        if (game.helpPanel) {
            game.helpPanel.remove();
            delete game.helpPanel;
            // Reopen help panel to show updated login status
            setTimeout(function() {
                if (game.helpButton && game.helpButton.onPress) {
                    game.helpButton.onPress();
                }
            }, 100);
        }
    });
}

function initDiscordAuth(): void {
    // Debug: Log the constructed redirect URI
    const redirectUri = window.location.origin + window.location.pathname.replace('index.html', '') + 'discord-callback.html';
    gameLogger.debug('Discord OAuth initialization', {
        redirectUri,
        currentLocation: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname
    });
    
    // Test if callback page is accessible
    fetch(redirectUri)
        .then(function(response) {
            gameLogger.debug('Discord callback page test', { 
                status: response.status,
                accessible: response.ok 
            });
            if (response.ok) {
                gameLogger.debug('✓ Discord callback page is accessible');
            } else {
                gameLogger.error('✗ Discord callback page not accessible', { status: response.status });
            }
        })
        .catch(function(error) {
            gameLogger.error('✗ Discord callback page test failed', { error: error.message });
        });
    
    // Initialize with a placeholder - the real client ID will be set by the server
    discordAuth = new DiscordOAuth({
        clientId: "506432803173433344", // fallback client ID
        redirectUri: redirectUri,
        scopes: ['identify']
    });
    
    // Setup event handlers for Discord OAuth
    setupDiscordAuthEventHandlers();
}

function addHelpButton(): void {
    // Help button
    game.helpButton = game.ui.addButton({ 
        text: '?', 
        bottom: 3, 
        right: 3, 
        w: 18, 
        h: 18, 
        onPress: function() {
            // Close server panel if it's open
            if (game.serverListPanel) {
                game.serverListPanel.remove();
                delete game.serverListPanel;
            }
            
            if (game.helpPanel) {
                game.helpPanel.remove();
                delete game.helpPanel;
                return;
            }
            
            game.helpPanel = game.ui.addPanel({ left: 'auto', top: 'auto', w: 200, h: 130 });
            game.ui.addLabel({ text: 'D-Zone (fork) ' + (version || packageInfo.version), top: 5, left: 'auto', parent: game.helpPanel });
            game.ui.addLabel({
                text: packageInfo.description, 
                top: 20, 
                left: 2, 
                maxWidth: 196, 
                parent: game.helpPanel
            });
            game.ui.addLabel({
                text: "This is a fork of D-Zone (originally by Vegeta897). It follows its own versioning and is not published on npm.", 
                top: 50, 
                left: 2, 
                maxWidth: 196, 
                parent: game.helpPanel
            });
            game.ui.addLabel({
                text: ':icon-npm: View on npm', 
                hyperlink: 'https://www.npmjs.com/package/d-zone',
                top: 90, 
                left: 8, 
                parent: game.helpPanel
            });
            game.ui.addLabel({
                text: 'View original :icon-github:', 
                hyperlink: 'https://github.com/d-zone-org/d-zone',
                top: 90, 
                right: 8, 
                parent: game.helpPanel
            });
            game.ui.addLabel({
                text: 'View fork :icon-github:', 
                hyperlink: 'https://github.com/nntin/d-zone',
                top: 110, 
                right: 8, 
                parent: game.helpPanel
            });
            
            // Add Discord login section
            const isLoggedIn = discordAuth && discordAuth.isLoggedIn();
            const user = discordAuth && discordAuth.getUser();
            
            if (isLoggedIn && user) {
                // User is logged in - show user info and logout button
                game.ui.addLabel({
                    text: `Logged in as: ${user.username}`,
                    top: 130,
                    left: 2,
                    parent: game.helpPanel
                });
                
                game.ui.addButton({
                    text: 'Logout Discord',
                    top: 150,
                    left: 2,
                    w: 80,
                    h: 16,
                    parent: game.helpPanel,
                    onPress: function() {
                        discordAuth.logout();
                    }
                });
            } else {
                // User is not logged in - show login button
                game.ui.addButton({
                    text: 'Login Discord',
                    top: 130,
                    left: 2,
                    w: 80,
                    h: 16,
                    parent: game.helpPanel,
                    onPress: function() {
                        discordAuth.login();
                    }
                });
                
                game.ui.addLabel({
                    text: 'Login required for private servers',
                    top: 150,
                    left: 2,
                    maxWidth: 196,
                    parent: game.helpPanel
                });
            }
            
            // Resize help panel to fit content
            game.helpPanel.resize(200, isLoggedIn ? 170 : 170);
        }
    });
}

export function initWebsocket(): void {
    // Initialize the game components now that they're properly imported
    let users: Users, world: World | undefined, decorator: Decorator | undefined;

    // Function to clean up event listeners and prevent memory leaks
    function cleanupEventListeners(): void {
        if (users && users.removeAllListeners) users.removeAllListeners();
        if (world && world.removeAllListeners) world.removeAllListeners();
        if (decorator && decorator.removeAllListeners) decorator.removeAllListeners();
    }

    // Multiple fallback strategies for websocket connection
    const fallbackStrategies: { url: string; description: string }[] = [];
    
    // Strategy 1: URL parameter
    const urlSocketURL = util.getURLParameter('socketURL');
    if (urlSocketURL) {
        fallbackStrategies.push({
            url: urlSocketURL,
            description: 'URL parameter'
        });
    }
    
    // Strategy 2: Current hostname and pathname
    let currentHostStrategy = 'wss://' + window.location.hostname + window.location.pathname;
    // Remove trailing slash and add websocket path if needed
    currentHostStrategy = currentHostStrategy.replace(/\/$/, '') + '/ws';
    fallbackStrategies.push({
        url: currentHostStrategy,
        description: 'current hostname and pathname'
    });
    
    // Strategy 3: Hermes fallback
    fallbackStrategies.push({
        url: 'wss://hermes.nntin.xyz/dzone',
        description: 'Hermes fallback server'
    });

    let currentStrategyIndex = 0;

    function tryNextWebsocketConnection(): void {
        if (currentStrategyIndex >= fallbackStrategies.length) {
            gameLogger.error('All websocket connection strategies failed', {
                totalStrategies: fallbackStrategies.length,
                attemptedStrategies: fallbackStrategies.map(s => s.description)
            });
            return;
        }

        const strategy = fallbackStrategies[currentStrategyIndex];
        gameLogger.info('Attempting websocket connection', { 
            strategyIndex: currentStrategyIndex + 1,
            totalStrategies: fallbackStrategies.length,
            description: strategy.description,
            url: strategy.url
        });

        // Swap the comments on the next 3 lines to switch between your websocket server and a virtual one
        ws = new WebSocket(strategy.url);
        //const TestSocket = require('./script/engine/tester.js'),
        //ws = new TestSocket(50, 3000);
        
        ws.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            gameLogger.websocketMessageReceived(data);
            
            if (decorator) decorator.beacon.ping();
            
            if (data.type === 'server-list') {
                game.servers = data.data;
                gameLogger.info('Received server list', { 
                    serverCount: game.servers ? Object.keys(game.servers).length : 0,
                    servers: game.servers 
                });
                
                // Server button
                game.ui.addButton({ 
                    text: 'Server', 
                    top: 3, 
                    right: 3, 
                    onPress: function() {
                        // Close help panel if it's open
                        if (game.helpPanel) {
                            game.helpPanel.remove();
                            delete game.helpPanel;
                        }
                        
                        if (game.serverListPanel) {
                            game.serverListPanel.remove();
                            delete game.serverListPanel;
                            return;
                        }
                        
                        const joinThisServer = function(server: any) { 
                            return function() {
                                // Check if Discord authentication is required only for passworded servers
                                if (server.passworded && (!discordAuth || !discordAuth.isLoggedIn())) {
                                    game.pendingServerJoin = server;
                                    (window as any).alert('This server requires Discord authentication. Please login with Discord first.');
                                    return;
                                }
                                
                                const params = '?s=' + server.id;
                                if (window.location.protocol !== 'file:') {
                                    window.history.pushState(
                                        {server: server.id},
                                        server.id, window.location.pathname + params
                                    );
                                }
                                joinServer(server);
                                game.serverListPanel.remove();
                                delete game.serverListPanel;
                            }; 
                        };
                        
                        game.serverListPanel = game.ui.addPanel({
                            left: 'auto', 
                            top: 'auto', 
                            w: 146, 
                            h: 28 + 21 * (Object.keys(game.servers || {}).length - 1)
                        });
                        
                        let widestButton = 136;
                        let serverButtonY = 0;
                        let button: any;
                        
                        for (const sKey in game.servers) { 
                            if (!game.servers || !game.servers.hasOwnProperty(sKey)) continue;
                            const server = game.servers[sKey];
                            // Show lock icon for servers that require Discord OAuth (passworded servers)
                            const serverLock = server.passworded ? ':icon-lock-small: ' : '';
                            button = game.ui.addButton({
                                text: serverLock + game.servers[sKey].name, 
                                left: 5, 
                                top: 5 + serverButtonY * 21,
                                w: 136, 
                                h: 18, 
                                parent: game.serverListPanel, 
                                onPress: joinThisServer(server), 
                                disabled: game.server === server.id
                            });
                            widestButton = Math.max(widestButton, button.textCanvas.width + 2);
                            serverButtonY++;
                        }
                        game.serverListPanel.resize(widestButton + 10, game.serverListPanel.h);
                        game.serverListPanel.resizeChildren(widestButton, button.h);
                        game.serverListPanel.reposition();
                    } 
                });
                
                const startupServer = getStartupServer();
                // Only require Discord auth for passworded servers
                const serverData = game.servers?.[startupServer.id];
                if (!serverData || !serverData.passworded || (discordAuth && discordAuth.isLoggedIn())) {
                    joinServer(startupServer);
                } else {
                    game.pendingServerJoin = startupServer;
                }
            } else if (data.type === 'server-join') { // Initial server status
                const requestServer = data.data.request.server;
                localStorage.setItem('dzone-default-server', JSON.stringify({ id: requestServer }));
                
                gameLogger.serverJoined(requestServer, data.data.serverName);
                
                // Update Discord OAuth client ID if provided
                if (data.data.clientId && discordAuth) {
                    gameLogger.info('Setting Discord OAuth client ID from server-join', { clientId: data.data.clientId });
                    reinitializeDiscordAuth(data.data.clientId);
                }
                
                // Clean up existing event listeners to prevent memory leaks
                cleanupEventListeners();
                
                game.reset();
                game.renderer.clear();
                const userList = data.data.users;
                game.server = requestServer;
                
                // Initialize the game components now that they're properly converted to TS
                world = new World(game as any, Math.round(3.3 * Math.sqrt(Object.keys(userList).length)));
                decorator = new Decorator(game as any, world as any);
                game.decorator = decorator;
                users = new Users(game as any, world as any);
                
                const params = '?s=' + data.data.request.server;
                if (window.location.protocol !== 'file:') {
                    window.history.replaceState(
                        data.data.request, requestServer, window.location.pathname + params
                    );
                }
                const userCount = Object.keys(userList).length;
                game.setMaxListeners(userCount + 100);
                users.setMaxListeners(userCount + 50);
                // Set max listeners for world and decorator to prevent memory leaks
                if (world && world.setMaxListeners) world.setMaxListeners(userCount + 50);
                if (decorator && decorator.setMaxListeners) decorator.setMaxListeners(userCount + 50);
                
                for (const uid in userList) { 
                    if (!userList.hasOwnProperty(uid)) continue;
                    //if(uid != '86913608335773696') continue;
                    //if(data.data[uid].status != 'online') continue;
                    if (!userList[uid].username) continue;
                    if (users) users.addActor(userList[uid]); // Fire and forget async call
                    //break;
                }
                const actorCount = users ? Object.keys(users.actors).length : 0;
                gameLogger.info('Actors initialized', { 
                    totalUsers: userCount, 
                    createdActors: actorCount,
                    skippedUsers: userCount - actorCount
                });
                game.renderer.canvases[0].onResize();
            } else if (data.type === 'presence') { // User status update
                gameLogger.debug('Actor presence update', { uid: data.data.uid, presence: data.data.presence });
                if (users) users.updateActor(data.data); // Fire and forget async call
            } else if (data.type === 'message') { // Chatter
                gameLogger.debug('Message received', { 
                    channel: data.data.channel, 
                    user: data.data.user?.username,
                    messageLength: data.data.content?.length 
                });
                users.queueMessage(data.data);
            } else if (data.type === 'error') {
                gameLogger.error('Server error received', { message: data.data.message });
                (window as any).alert(data.data.message);
                if (!game.world) joinServer({id: 'default'});
            } else if (data.type === 'update-clientid') { // Client ID update
                gameLogger.info('Received client ID update', { clientId: data.data.clientId });
                if (data.data.clientId && discordAuth) {
                    reinitializeDiscordAuth(data.data.clientId);
                    // Show a notification to the user that the OAuth configuration has been updated
                    if (game && game.ui) {
                        // Create a temporary notification panel
                        const notificationPanel = game.ui.addPanel({ 
                            left: 'auto', 
                            top: 50, 
                            w: 250, 
                            h: 60,
                            backgroundColor: '#2c3e50'
                        });
                        game.ui.addLabel({ 
                            text: '🔄 Discord OAuth Updated', 
                            top: 5, 
                            left: 'auto', 
                            parent: notificationPanel,
                            color: '#ecf0f1'
                        });
                        game.ui.addLabel({ 
                            text: 'Discord login configuration has been updated.', 
                            top: 25, 
                            left: 5, 
                            maxWidth: 240, 
                            parent: notificationPanel,
                            color: '#bdc3c7'
                        });
                        
                        // Auto-remove the notification after 5 seconds
                        setTimeout(function() {
                            if (notificationPanel && notificationPanel.remove) {
                                notificationPanel.remove();
                            }
                        }, 5000);
                    }
                }
            } else {
            }
        });
        
        ws.addEventListener('open', function() { 
            gameLogger.websocketConnected(strategy.url);
        });
        
        ws.addEventListener('close', function() {
            gameLogger.websocketDisconnected(`Strategy: ${strategy.description}`);
            cleanupEventListeners();
            // Only try next strategy if we haven't already moved to the next one due to an error
            if (currentStrategyIndex === fallbackStrategies.indexOf(strategy)) {
                currentStrategyIndex++;
                setTimeout(tryNextWebsocketConnection, 1000); // Wait 1 second before trying next strategy
            }
        });
        
        ws.addEventListener('error', function(err) {
            gameLogger.warn('Websocket connection error', { 
                strategy: strategy.description,
                strategyIndex: currentStrategyIndex + 1,
                totalStrategies: fallbackStrategies.length,
                error: err 
            });
            // Only increment if we haven't already incremented due to close event
            if (currentStrategyIndex === fallbackStrategies.indexOf(strategy)) {
                currentStrategyIndex++;
                setTimeout(tryNextWebsocketConnection, 1000); // Wait 1 second before trying next strategy
            }
        });
    }

    // Start with the first strategy
    tryNextWebsocketConnection();
}

(window as any).onpopstate = function(event: PopStateEvent) {
    const server = { id: event.state?.server };
    joinServer(server);
};

export function joinServer(server: { id: string }): void {
    const connectionMessage: any = { type: 'connect', data: { server: server.id } };
    
    // Find the server data by looking through all servers for matching ID
    let serverData = null;
    if (game.servers) {
        for (const discordId in game.servers) {
            if (game.servers.hasOwnProperty(discordId) && game.servers[discordId].id === server.id) {
                serverData = game.servers[discordId];
                break;
            }
        }
    }
    
    gameLogger.debug('Server lookup for connection', {
        requestedServerId: server.id,
        foundServerData: serverData ? { id: serverData.id, passworded: serverData.passworded } : null,
        serverCount: game.servers ? Object.keys(game.servers).length : 0
    });
    
    // Only send Discord OAuth token for passworded servers
    if (serverData && serverData.passworded && discordAuth && discordAuth.isLoggedIn()) {
        connectionMessage.data.discordToken = discordAuth.accessToken;
        connectionMessage.data.discordUser = discordAuth.getUser();
        gameLogger.info('Sending Discord OAuth data for passworded server', {
            tokenLength: discordAuth.accessToken ? discordAuth.accessToken.length : 0,
            hasUser: !!discordAuth.getUser(),
            serverId: server.id
        });
    } else {
        gameLogger.debug('Not sending Discord OAuth data', {
            serverFound: !!serverData,
            serverPassworded: serverData ? serverData.passworded : 'unknown',
            discordAuthExists: !!discordAuth,
            discordLoggedIn: discordAuth ? discordAuth.isLoggedIn() : false
        });
    }
    
    gameLogger.info('Requesting to join server', {
        serverId: server.id,
        hasDiscordAuth: !!connectionMessage.data.discordToken
    });
    ws.send(JSON.stringify(connectionMessage));
}

export function getStartupServer(): { id: string } {
    // Get startup server, first checking URL params, then localstorage
    let startupServer: any = { id: util.getURLParameter('s') }; // Check URL params
    if (!startupServer.id) {
        const stored = localStorage.getItem('dzone-default-server'); // Check localstorage
        if (stored) startupServer = JSON.parse(stored);
    }
    if (!startupServer/* || !game.servers[startupServer.id]*/) startupServer = { id: 'default' };
    // Remove password parameter support since we use Discord OAuth
    return startupServer;
}

//setTimeout(function() { game.paused = true; },1000);

// Export util for testing
export { util };

// Main app initialization function - call this to start the app
export function startApp(): void {
    // TODO: Loading screen while preloading images, connecting to websocket, and generating world
    gameLogger.info('Starting D-Zone application', { version: packageInfo.version });
    version = packageInfo.version;
    preloader = new Preloader(initGame);
}

// Auto-start the app if this module is being run in the browser (not being imported for testing)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    startApp();
    // Make joinServer available globally for E2E testing
    (window as any).joinServer = joinServer;
}