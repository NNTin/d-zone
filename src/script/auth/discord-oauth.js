'use strict';
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

module.exports = DiscordOAuth;
inherits(DiscordOAuth, EventEmitter);

function DiscordOAuth(options) {
    this.clientId = options.clientId;
    this.redirectUri = options.redirectUri || window.location.origin + '/discord-callback.html';
    this.scopes = options.scopes || ['identify'];
    this.state = this.generateState();
    this.accessToken = null;
    this.user = null;
    
    // Check for existing token in localStorage
    this.loadStoredAuth();
}

DiscordOAuth.prototype.generateState = function() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

DiscordOAuth.prototype.getAuthUrl = function() {
    var params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'token', // Use implicit flow instead of authorization code
        scope: this.scopes.join(' '),
        state: this.state
    });
    
    return 'https://discord.com/api/oauth2/authorize?' + params.toString();
};

DiscordOAuth.prototype.login = function() {
    var authUrl = this.getAuthUrl();
    
    // Store state for verification
    localStorage.setItem('discord_oauth_state', this.state);
    
    // Open Discord OAuth in a popup window
    var popup = window.open(authUrl, 'discord_oauth', 'width=500,height=700,scrollbars=yes');
    
    var self = this;
    
    // Listen for messages from the popup
    var messageHandler = function(event) {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'discord-auth-success') {
            var accessToken = event.data.accessToken;
            var state = event.data.state;
            var expiresIn = event.data.expiresIn;
            
            window.removeEventListener('message', messageHandler);
            
            if (state !== self.state) {
                self.emit('login-error', 'Invalid state parameter');
                return;
            }
            
            if (accessToken) {
                self.accessToken = accessToken;
                self.storeAuth({ access_token: accessToken, expires_in: expiresIn });
                self.fetchUserInfo();
            } else {
                self.emit('login-error', 'No access token received');
            }
        } else if (event.data.type === 'discord-auth-error') {
            window.removeEventListener('message', messageHandler);
            self.emit('login-error', event.data.error);
        }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Fallback: Check if popup was closed
    var pollTimer = setInterval(function() {
        if (popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener('message', messageHandler);
            self.emit('login-cancelled');
        }
    }, 1000);
};

DiscordOAuth.prototype.fetchUserInfo = function() {
    var self = this;
    
    fetch('https://discord.com/api/users/@me', {
        headers: {
            'Authorization': 'Bearer ' + this.accessToken
        }
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(user) {
        self.user = user;
        // Store user info in localStorage
        localStorage.setItem('discord_user', JSON.stringify(user));
        self.emit('login-success', user);
    })
    .catch(function(error) {
        self.emit('login-error', error.message);
    });
};

DiscordOAuth.prototype.logout = function() {
    this.accessToken = null;
    this.user = null;
    localStorage.removeItem('discord_auth_token');
    localStorage.removeItem('discord_auth_expires');
    localStorage.removeItem('discord_user');
    this.emit('logout');
};

DiscordOAuth.prototype.storeAuth = function(tokenData) {
    localStorage.setItem('discord_auth_token', tokenData.access_token);
    if (tokenData.expires_in) {
        var expiresAt = Date.now() + (tokenData.expires_in * 1000);
        localStorage.setItem('discord_auth_expires', expiresAt.toString());
    }
};

DiscordOAuth.prototype.loadStoredAuth = function() {
    var token = localStorage.getItem('discord_auth_token');
    var expiresAt = localStorage.getItem('discord_auth_expires');
    var userData = localStorage.getItem('discord_user');
    
    if (token && (!expiresAt || Date.now() < parseInt(expiresAt))) {
        this.accessToken = token;
        if (userData) {
            try {
                this.user = JSON.parse(userData);
            } catch (e) {
                // Invalid user data, ignore
            }
        }
        
        // Verify token is still valid by fetching user info
        if (this.accessToken && !this.user) {
            this.fetchUserInfo();
        }
    } else {
        // Token expired or doesn't exist
        this.logout();
    }
};

DiscordOAuth.prototype.isLoggedIn = function() {
    return !!(this.accessToken && this.user);
};

DiscordOAuth.prototype.getUser = function() {
    return this.user;
};

DiscordOAuth.prototype.getAvatarUrl = function(size) {
    if (!this.user || !this.user.avatar) return null;
    size = size || 128;
    return 'https://cdn.discordapp.com/avatars/' + this.user.id + '/' + this.user.avatar + '.png?size=' + size;
};
