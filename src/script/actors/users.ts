'use strict';

import { EventEmitter } from 'events';

interface UserData {
    uid: string;
    username: string;
    status: string;
    roleColor?: string;
    delete?: boolean;
}

interface MessageData {
    uid: string;
    message: string;
    channel: string;
}

interface QueuedMessage {
    uid: string;
    message: string;
}

interface MessageChannel {
    busy: boolean;
    messages: QueuedMessage[];
}

interface Actor {
    uid: string;
    position: { x: number; y: number; z: number };
    addToGame(game: any): void;
    updatePresence(status: string): void;
    startTalking(message: string, channel: string, callback: () => void): void;
    remove(): void;
}

interface World {
    randomEmptyGrid(): string;
}

interface Game {
    users?: Users;
    once(event: string, callback: Function): void;
}

let ActorClass: any;
let ActorLoadPromise: Promise<void> | null = null;

export default class Users extends EventEmitter {
    game: Game;
    world: World;
    actors: Record<string, Actor> = {};
    messageQueue: Record<string, MessageChannel> = {};

    constructor(game: Game, world: World) {
        super();
        this.setMaxListeners(0);
        this.game = game;
        this.game.once('destroy', this.destroy.bind(this));
        this.game.users = this;
        this.world = world;
        this.actors = {};
        this.messageQueue = {};
        
        // Start loading the Actor class immediately
        ActorLoadPromise = this.loadActor();
    }

    private async loadActor(): Promise<void> {
        try {
            const ActorModule = await import('./actor.js');
            ActorClass = ActorModule.default;
            console.log('✅ Actor class loaded successfully');
        } catch (error) {
            console.error('Failed to load Actor class:', error);
            throw error;
        }
    }

    async addActor(data: UserData): Promise<void> {
        // Wait for Actor class to load if it hasn't already
        if (!ActorClass && ActorLoadPromise) {
            console.log('⏳ Waiting for Actor class to load...');
            await ActorLoadPromise;
        }

        if (!ActorClass) {
            console.error('❌ Actor class not loaded yet');
            return;
        }

        console.log('🎭 Creating new actor:', data.username);
        const grid = this.world.randomEmptyGrid();
        const actor = new ActorClass({
            x: +grid.split(':')[0],
            y: +grid.split(':')[1],
            z: 0,
            uid: data.uid,
            username: data.username,
            roleColor: data.roleColor,
            maxListeners: this.getMaxListeners() + 3
        }) as Actor;
        
        this.actors[actor.uid] = actor;
        actor.addToGame(this.game);
        actor.updatePresence(data.status);
        console.log('✅ Actor created successfully:', data.username);
    }

    async updateActor(data: UserData): Promise<void> {
        const actor = this.actors[data.uid];
        if(actor) {
            if(data.delete) {
                actor.updatePresence('offline');
                this.removeActor(actor);
            } else {
                actor.updatePresence(data.status);
            }
        } else {
            await this.addActor(data);
        }
    }

    removeActor(actor: Actor): void {
        delete this.actors[actor.uid];
        actor.remove();
    }

    queueMessage(data: MessageData): void {
        if(!data.message || !this.actors[data.uid]) return;
        if(!this.messageQueue[data.channel]) {
            this.messageQueue[data.channel] = { busy: false, messages: [] };
        }
        this.messageQueue[data.channel].messages.push({
            uid: data.uid,
            message: data.message
        });
        this.onMessageAdded(data.channel);
    }

    onMessageAdded(channel: string): void {
        const queue = this.messageQueue[channel];
        if(queue.busy || queue.messages.length < 1) return;
        
        queue.busy = true;
        const message = queue.messages[0];
        const self = this;
        
        this.actors[message.uid].startTalking(message.message, channel, function() {
            self.messageQueue[channel].messages.shift();
            self.messageQueue[channel].busy = false;
            self.onMessageAdded(channel);
        });
        
        this.emit('message', { user: this.actors[message.uid], channel: channel });
    }

    getActorAtPosition(x: number, y: number, z: number): Actor | undefined { // For debugging
        for(const aKey in this.actors) {
            if(!this.actors.hasOwnProperty(aKey)) continue;
            if(this.actors[aKey].position.x == x
                && this.actors[aKey].position.y == y
                && this.actors[aKey].position.z == z) {
                return this.actors[aKey];
            }
        }
        return undefined;
    }

    destroy(): void {
        this.actors = {};
        this.messageQueue = {};
    }
}