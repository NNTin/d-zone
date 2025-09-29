'use strict';

import { EventEmitter } from 'events';

interface DiscordOAuthOptions {
    clientId: string;
    redirectUri?: string;
    scopes?: string[];
}

interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    [key: string]: any;
}

interface TokenData {
    access_token: string;
    expires_in?: number;
}

interface AuthSuccessMessage {
    type: 'discord-auth-success';
    accessToken: string;
    state: string;
    expiresIn?: number;
}

interface AuthErrorMessage {
    type: 'discord-auth-error';
    error: string;
}

export class DiscordOAuth extends EventEmitter {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    state: string;
    accessToken: string | null = null;
    user: DiscordUser | null = null;

    constructor(options: DiscordOAuthOptions) {
        super();
        this.clientId = options.clientId;
        this.redirectUri = options.redirectUri || window.location.origin + '/discord-callback.html';
        this.scopes = options.scopes || ['identify'];
        this.state = this.generateState();
        
        // Check for existing token in localStorage
        this.loadStoredAuth();
    }

    generateState(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    getAuthUrl(): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'token', // Use implicit flow instead of authorization code
            scope: this.scopes.join(' '),
            state: this.state
        });
        
        return 'https://discord.com/api/oauth2/authorize?' + params.toString();
    }

    login(): void {
        const authUrl = this.getAuthUrl();
        console.log('Starting Discord OAuth login with URL:', authUrl);
        
        // Store state for verification
        localStorage.setItem('discord_oauth_state', this.state);
        
        // Open Discord OAuth in a popup window
        const popup = window.open(authUrl, 'discord_oauth', 'width=500,height=700,scrollbars=yes');
        
        if (!popup) {
            console.error('Popup was blocked by browser');
            this.emit('login-error', 'Popup was blocked by browser. Please allow popups for this site.');
            return;
        }
        
        console.log('Discord OAuth popup opened successfully');
        
        const self = this;
        
        // Listen for messages from the popup
        const messageHandler = (event: MessageEvent) => {
            console.log('Received message from popup:', event.data, 'from origin:', event.origin);
            
            if (event.origin !== window.location.origin) {
                console.log('Ignoring message from different origin:', event.origin);
                return;
            }
            
            const data = event.data as AuthSuccessMessage | AuthErrorMessage;
            
            if (data.type === 'discord-auth-success') {
                const successData = data as AuthSuccessMessage;
                const accessToken = successData.accessToken;
                const state = successData.state;
                const expiresIn = successData.expiresIn;
                
                console.log('Discord auth success received, access token length:', accessToken ? accessToken.length : 0);
                
                window.removeEventListener('message', messageHandler);
                
                if (state !== self.state) {
                    console.error('State mismatch. Expected:', self.state, 'Received:', state);
                    self.emit('login-error', 'Invalid state parameter');
                    return;
                }
                
                if (accessToken) {
                    self.accessToken = accessToken;
                    self.storeAuth({ access_token: accessToken, expires_in: expiresIn });
                    self.fetchUserInfo();
                } else {
                    console.error('No access token in success message');
                    self.emit('login-error', 'No access token received');
                }
            } else if (data.type === 'discord-auth-error') {
                const errorData = data as AuthErrorMessage;
                console.error('Discord auth error received:', errorData.error);
                window.removeEventListener('message', messageHandler);
                self.emit('login-error', errorData.error);
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Fallback: Check if popup was closed
        const pollTimer = setInterval(() => {
            if (popup.closed) {
                console.log('Discord OAuth popup was closed');
                clearInterval(pollTimer);
                window.removeEventListener('message', messageHandler);
                self.emit('login-cancelled');
            }
        }, 1000);
    }

    fetchUserInfo(): void {
        const self = this;
        
        fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': 'Bearer ' + this.accessToken
            }
        })
        .then(response => response.json())
        .then((user: DiscordUser) => {
            self.user = user;
            // Store user info in localStorage
            localStorage.setItem('discord_user', JSON.stringify(user));
            self.emit('login-success', user);
        })
        .catch((error: Error) => {
            self.emit('login-error', error.message);
        });
    }

    logout(): void {
        this.accessToken = null;
        this.user = null;
        localStorage.removeItem('discord_auth_token');
        localStorage.removeItem('discord_auth_expires');
        localStorage.removeItem('discord_user');
        this.emit('logout');
    }

    storeAuth(tokenData: TokenData): void {
        localStorage.setItem('discord_auth_token', tokenData.access_token);
        if (tokenData.expires_in) {
            const expiresAt = Date.now() + (tokenData.expires_in * 1000);
            localStorage.setItem('discord_auth_expires', expiresAt.toString());
        }
    }

    loadStoredAuth(): void {
        const token = localStorage.getItem('discord_auth_token');
        const expiresAt = localStorage.getItem('discord_auth_expires');
        const userData = localStorage.getItem('discord_user');
        
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
    }

    isLoggedIn(): boolean {
        return !!(this.accessToken && this.user);
    }

    getUser(): DiscordUser | null {
        return this.user;
    }

    getAvatarUrl(size: number = 128): string | null {
        if (!this.user || !this.user.avatar) return null;
        return `https://cdn.discordapp.com/avatars/${this.user.id}/${this.user.avatar}.png?size=${size}`;
    }
}

export default DiscordOAuth;