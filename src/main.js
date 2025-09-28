'use strict';
var util = require('./script/common/util.js');
var Preloader = require('./script/engine/preloader.js');
var Game = require('./script/engine/game.js');
var Renderer = require('./script/engine/renderer.js');
var Canvas = require('./script/engine/canvas.js');
var UI = require('./script/ui/ui.js');
var DiscordOAuth = require('./script/auth/discord-oauth.js');
var packageInfo = require('./../package.json');
var socketConfig = require('./socket-config.json');

// TODO: Loading screen while preloading images, connecting to websocket, and generating world
console.log('Loading...');
var version = packageInfo.version;
var preloader = new Preloader(initGame);
var game, ws, discordAuth;

function initGame(images) {
    game = new Game({ step: 1000 / 60 });
    game.renderer = new Renderer({ game: game, images: images });
    var canvas = new Canvas({ id: 'main', game: game, initialScale: 2, backgroundColor: '#181213' });
    game.renderer.addCanvas(canvas);
    game.bindCanvas(canvas);
    game.ui = new UI(game);
    //game.showGrid = true;
    //game.timeRenders = true;
    
    // Initialize Discord OAuth
    initDiscordAuth();
    
    // Add help button immediately after UI initialization
    addHelpButton();
    
    // Ensure UI is properly sized after adding the help button
    game.renderer.canvases[0].onResize();
    
    initWebsocket();

    window.pause = function() { game.paused = true; };
    window.unpause = function() { game.paused = false; };
    window.game = game;
}

function reinitializeDiscordAuth(newClientId) {
    console.log('Reinitializing Discord OAuth with new client ID:', newClientId);
    
    // Store the current state
    var wasLoggedIn = discordAuth && discordAuth.isLoggedIn();
    var currentUser = discordAuth ? discordAuth.getUser() : null;
    
    // Create new Discord OAuth instance with updated client ID
    var redirectUri = window.location.origin + window.location.pathname.replace('index.html', '') + 'discord-callback.html';
    
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
        console.log('Discord OAuth client ID updated. User may need to re-authenticate if they encounter issues.');
        // The stored access token may not work with the new client ID
        // but we'll let the user discover this naturally rather than forcing re-auth
    }
    
    console.log('Discord OAuth reinitialized successfully');
}

function setupDiscordAuthEventHandlers() {
    // Add debug logging to the login method
    var originalLogin = discordAuth.login;
    discordAuth.login = function() {
        var authUrl = this.getAuthUrl();
        console.log('Discord OAuth URL:', authUrl);
        console.log('Opening Discord OAuth popup...');
        return originalLogin.apply(this, arguments);
    };
    
    discordAuth.on('login-success', function(user) {
        console.log('Discord login successful:', user);
        // Store user info
        localStorage.setItem('discord_user', JSON.stringify(user));
        
        // If user was trying to join a server, try again now that they're authenticated
        if(game.pendingServerJoin) {
            joinServer(game.pendingServerJoin);
            delete game.pendingServerJoin;
        }
        
        // Update help panel if it's open
        if(game.helpPanel) {
            game.helpPanel.remove();
            delete game.helpPanel;
            // Reopen help panel to show updated login status
            setTimeout(function() {
                if(game.helpButton && game.helpButton.onPress) {
                    game.helpButton.onPress();
                }
            }, 100);
        }
    });
    
    discordAuth.on('login-error', function(error) {
        console.error('Discord login error:', error);
        window.alert('Discord login failed: ' + error);
    });
    
    discordAuth.on('login-cancelled', function() {
        console.log('Discord login cancelled by user');
    });
    
    discordAuth.on('logout', function() {
        console.log('Discord logout');
        
        // Update help panel if it's open
        if(game.helpPanel) {
            game.helpPanel.remove();
            delete game.helpPanel;
            // Reopen help panel to show updated login status
            setTimeout(function() {
                if(game.helpButton && game.helpButton.onPress) {
                    game.helpButton.onPress();
                }
            }, 100);
        }
    });
}

function initDiscordAuth() {
    // Debug: Log the constructed redirect URI
    var redirectUri = window.location.origin + window.location.pathname.replace('index.html', '') + 'discord-callback.html';
    console.log('Discord OAuth redirect URI:', redirectUri);
    console.log('Current location:', window.location.href);
    console.log('Window origin:', window.location.origin);
    console.log('Window pathname:', window.location.pathname);
    
    // Test if callback page is accessible
    fetch(redirectUri)
        .then(function(response) {
            console.log('Callback page test - Status:', response.status);
            if (response.ok) {
                console.log('✓ Callback page is accessible');
            } else {
                console.error('✗ Callback page not accessible - Status:', response.status);
            }
        })
        .catch(function(error) {
            console.error('✗ Callback page test failed:', error);
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

function addHelpButton() {
    // Help button
    game.helpButton = game.ui.addButton({ text: '?', bottom: 3, right: 3, w: 18, h: 18, onPress: function() {
        // Close server panel if it's open
        if(game.serverListPanel) {
            game.serverListPanel.remove();
            delete game.serverListPanel;
        }
        
        if(game.helpPanel) {
            game.helpPanel.remove();
            delete game.helpPanel;
            return;
        }
        game.helpPanel = game.ui.addPanel({ left: 'auto', top: 'auto', w: 200, h: 130 });
        game.ui.addLabel({ text: 'D-Zone (fork) '+version, top: 5, left: 'auto', parent: game.helpPanel });
        game.ui.addLabel({
            text: packageInfo.description, top: 20, left: 2, maxWidth: 196, parent: game.helpPanel
        });
        game.ui.addLabel({
            text: "This is a fork of D-Zone (originally by Vegeta897). It follows its own versioning and is not published on npm.", top: 50, left: 2, maxWidth: 196, parent: game.helpPanel
        });
        game.ui.addLabel({
            text: ':icon-npm: View on npm', hyperlink: 'https://www.npmjs.com/package/d-zone',
            top: 90, left: 8, parent: game.helpPanel
        });
        game.ui.addLabel({
            text: 'View original :icon-github:', hyperlink: 'https://github.com/d-zone-org/d-zone',
            top: 90, right: 8, parent: game.helpPanel
        });
        game.ui.addLabel({
            text: 'View fork :icon-github:', hyperlink: 'https://github.com/nntin/d-zone',
            top: 110, right: 8, parent: game.helpPanel
        });
        
        // Discord login/logout functionality
        if(discordAuth && discordAuth.isLoggedIn()) {
            var user = discordAuth.getUser();
            game.ui.addLabel({
                text: ':icon-lock: ' + user.username,
                top: 110, left: 8, parent: game.helpPanel,
                hyperlink: '#', // Use placeholder to enable cursor change
                onPress: function() {
                    // Show logout option
                    if(window.confirm('Logout from Discord?')) {
                        discordAuth.logout();
                    }
                }
            });
        } else {
            game.ui.addLabel({
                text: ':icon-lock: Login with Discord',
                top: 110, left: 8, parent: game.helpPanel,
                hyperlink: '#', // Add hyperlink property to make cursor change on hover
                onPress: function() {
                    if(discordAuth) {
                        discordAuth.login();
                    }
                }
            });
        }
    }});
}

function initWebsocket() {
    var World = require('./script/environment/world.js');
    var Users = require('./script/actors/users.js');
    var Decorator = require('./script/props/decorator.js');
    var users, world, decorator;

    // Function to clean up event listeners and prevent memory leaks
    function cleanupEventListeners() {
        if(users && users.removeAllListeners) users.removeAllListeners();
        if(world && world.removeAllListeners) world.removeAllListeners();
        if(decorator && decorator.removeAllListeners) decorator.removeAllListeners();
    }

    // Multiple fallback strategies for websocket connection
    var fallbackStrategies = [];
    
    // Strategy 1: URL parameter
    var urlSocketURL = util.getURLParameter('socketURL');
    if (urlSocketURL) {
        fallbackStrategies.push({
            url: urlSocketURL,
            description: 'URL parameter'
        });
    }
    
    // Strategy 2: Current hostname and pathname
    var currentHostStrategy = 'wss://' + window.location.hostname + window.location.pathname;
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

    var currentStrategyIndex = 0;

    function tryNextWebsocketConnection() {
        if (currentStrategyIndex >= fallbackStrategies.length) {
            console.error('All websocket connection strategies failed');
            window.alert('Unable to connect to any websocket server. Please check your connection.');
            return;
        }

        var strategy = fallbackStrategies[currentStrategyIndex];
        console.log('Attempting websocket connection strategy ' + (currentStrategyIndex + 1) + '/' + fallbackStrategies.length + ': ' + strategy.description + ' (' + strategy.url + ')');

        // Swap the comments on the next 3 lines to switch between your websocket server and a virtual one
        ws = new WebSocket(strategy.url);
        //var TestSocket = require('./script/engine/tester.js'),
        //ws = new TestSocket(50, 3000);
        
        ws.addEventListener('message', function(event) {
            var data = JSON.parse(event.data);
            if(decorator) decorator.beacon.ping();
            if(data.type === 'server-list') {
                game.servers = data.data;
                console.log('Got server list:', game.servers);
                // Server button
                game.ui.addButton({ text: 'Server', top: 3, right: 3, onPress: function() {
                    // Close help panel if it's open
                    if(game.helpPanel) {
                        game.helpPanel.remove();
                        delete game.helpPanel;
                    }
                    
                    if(game.serverListPanel) {
                        game.serverListPanel.remove();
                        delete game.serverListPanel;
                        return;
                    }
                    var joinThisServer = function(server) { return function() {
                        // Check if Discord authentication is required only for passworded servers
                        if(server.passworded && (!discordAuth || !discordAuth.isLoggedIn())) {
                            game.pendingServerJoin = server;
                            window.alert('This server requires Discord authentication. Please login with Discord first.');
                            return;
                        }
                        
                        var params = '?s=' + server.id;
                        if(window.location.protocol !== 'file:') window.history.pushState(
                            {server: server.id},
                            server.id, window.location.pathname + params
                        );
                        joinServer(server);
                        game.serverListPanel.remove();
                        delete game.serverListPanel;
                    } };
                    game.serverListPanel = game.ui.addPanel({
                        left: 'auto', top: 'auto', w: 146, h: 28 + 21 * (Object.keys(game.servers).length - 1)
                    });
                    var widestButton = 136;
                    var serverButtonY = 0;
                    var button;
                    for(var sKey in game.servers) { if(!game.servers.hasOwnProperty(sKey)) continue;
                        var server = game.servers[sKey];
                        // Show lock icon for servers that require Discord OAuth (passworded servers)
                        var serverLock = server.passworded ? ':icon-lock-small: ' : '';
                        button = game.ui.addButton({
                            text: serverLock + game.servers[sKey].name, left: 5, top: 5 + serverButtonY * 21,
                            w: 136, h: 18, parent: game.serverListPanel, onPress: new joinThisServer(server), disabled: game.server === server.id
                        });
                        widestButton = Math.max(widestButton, button.textCanvas.width + 2);
                        serverButtonY++;
                    }
                    game.serverListPanel.resize(widestButton + 10, game.serverListPanel.h);
                    game.serverListPanel.resizeChildren(widestButton, button.h);
                    game.serverListPanel.reposition();
                } });
                var startupServer = getStartupServer();
                // Only require Discord auth for passworded servers
                var serverData = game.servers[startupServer.id];
                if(!serverData || !serverData.passworded || (discordAuth && discordAuth.isLoggedIn())) {
                    joinServer(startupServer);
                } else {
                    game.pendingServerJoin = startupServer;
                }
            } else if(data.type === 'server-join') { // Initial server status
                var requestServer = data.data.request.server;
                localStorage.setItem('dzone-default-server', JSON.stringify({ id: requestServer }));
                
                // Update Discord OAuth client ID if provided
                if(data.data.clientId && discordAuth) {
                    console.log('Setting Discord OAuth client ID from server-join:', data.data.clientId);
                    reinitializeDiscordAuth(data.data.clientId);
                }
                
                // Clean up existing event listeners to prevent memory leaks
                cleanupEventListeners();
                
                game.reset();
                game.renderer.clear();
                var userList = data.data.users;
                game.server = requestServer;
                world = new World(game, Math.round(3.3 * Math.sqrt(Object.keys(userList).length)));
                decorator = new Decorator(game, world);
                game.decorator = decorator;
                users = new Users(game, world);
                var params = '?s=' + data.data.request.server;
                if(window.location.protocol !== 'file:') window.history.replaceState(
                    data.data.request, requestServer, window.location.pathname + params
                );
                //return;
                //console.log('Initializing actors',data.data);
                var userCount = Object.keys(userList).length;
                game.setMaxListeners(userCount + 100);
                users.setMaxListeners(userCount + 50);
                // Set max listeners for world and decorator to prevent memory leaks
                if(world && world.setMaxListeners) world.setMaxListeners(userCount + 50);
                if(decorator && decorator.setMaxListeners) decorator.setMaxListeners(userCount + 50);
                for(var uid in userList) { if(!userList.hasOwnProperty(uid)) continue;
                    //if(uid != '86913608335773696') continue;
                    //if(data.data[uid].status != 'online') continue;
                    if(!userList[uid].username) continue;
                    users.addActor(userList[uid]);
                    //break;
                }
                console.log((Object.keys(users.actors).length).toString()+' actors created');
                game.renderer.canvases[0].onResize();
            } else if(data.type === 'presence') { // User status update
                users.updateActor(data.data)
            } else if(data.type === 'message') { // Chatter
                users.queueMessage(data.data);
            } else if(data.type === 'error') {
                window.alert(data.data.message);
                if(!game.world) joinServer({id: 'default'});
            } else if(data.type === 'update-clientid') { // Client ID update
                console.log('Received client ID update:', data.data.clientId);
                if(data.data.clientId && discordAuth) {
                    reinitializeDiscordAuth(data.data.clientId);
                    // Show a notification to the user that the OAuth configuration has been updated
                    if(game && game.ui) {
                        // Create a temporary notification panel
                        var notificationPanel = game.ui.addPanel({ 
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
                            if(notificationPanel && notificationPanel.remove) {
                                notificationPanel.remove();
                            }
                        }, 5000);
                    }
                }
            } else {
                //console.log('Websocket data:',data);
            }
        });
        
        ws.addEventListener('open', function() { 
            console.log('✓ Websocket connected successfully using strategy: ' + strategy.description + ' (' + strategy.url + ')'); 
        });
        
        ws.addEventListener('close', function() {
            console.log('Websocket disconnected from: ' + strategy.description);
            cleanupEventListeners();
        });
        
        ws.addEventListener('error', function(err) {
            console.log('Websocket error with strategy ' + (currentStrategyIndex + 1) + '/' + fallbackStrategies.length + ' (' + strategy.description + '):', err);
            // Try next strategy
            currentStrategyIndex++;
            setTimeout(tryNextWebsocketConnection, 1000); // Wait 1 second before trying next strategy
        });
    }

    // Start with the first strategy
    tryNextWebsocketConnection();    // window.testMessage = function(message) {
    //     var msg = message ? message.text : 'hello, test message yo!';
    //     var uid = message ? message.uid : users.actors[Object.keys(users.actors)[0]].uid;
    //     var channel = message ? message.channel : '1';
    //     ws.send('data', JSON.stringify({ type: 'message', data: {
    //         uid: uid, message: msg, channel: channel
    //     }}));
    // };
}

window.onpopstate = function(event) {
    var server = { id: event.state.server };
    joinServer(server);
};

function joinServer(server) {
    var connectionMessage = { type: 'connect', data: { server: server.id } };
    
    // Find the server data by looking through all servers for matching ID
    var serverData = null;
    for(var discordId in game.servers) {
        if(game.servers.hasOwnProperty(discordId) && game.servers[discordId].id === server.id) {
            serverData = game.servers[discordId];
            break;
        }
    }
    
    console.log('Server lookup result:', {
        requestedServerId: server.id,
        foundServerData: serverData,
        allServers: game.servers
    });
    
    // Only send Discord OAuth token for passworded servers
    if(serverData && serverData.passworded && discordAuth && discordAuth.isLoggedIn()) {
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
    
    console.log('Requesting to join server', server.id, 'with message:', connectionMessage);
    ws.send(new Buffer(JSON.stringify(connectionMessage)));
}

function getStartupServer() {
    // Get startup server, first checking URL params, then localstorage
    var startupServer = { id: util.getURLParameter('s') }; // Check URL params
    if(!startupServer.id) {
        startupServer = localStorage.getItem('dzone-default-server'); // Check localstorage
        if(startupServer) startupServer = JSON.parse(startupServer);
    }
    if(!startupServer/* || !game.servers[startupServer.id]*/) startupServer = { id: 'default' };
    // Remove password parameter support since we use Discord OAuth
    return startupServer;
}

//setTimeout(function() { game.paused = true; },1000);
