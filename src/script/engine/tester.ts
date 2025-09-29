'use strict';

import { EventEmitter } from 'events';
import { util } from '../common/util.js';

interface User {
    user: {
        username: string;
        id: string;
        discriminator: number;
        avatar: string;
    };
    roles: string[];
    mute: boolean;
    joined_at: string;
    deaf: boolean;
    game_id: number | null;
    status?: string;
}

interface RandomUserOptions {
    status?: string;
}

export default class TestSocket extends EventEmitter {
    userCount: number;
    updateInterval: number;
    users: Record<string, User> = {};

    constructor(userCount: number, updateInterval: number) {
        super();
        this.userCount = userCount;
        this.updateInterval = updateInterval;
        setTimeout(this.connect.bind(this), 200);
    }

    connect(): void {
        this.emit('connect');
        this.users = {};
        for(let i = 0; i < this.userCount; i++) {
            const user = this.newUser();
            this.users[user.user.id] = user;
        }
        const self = this;
        setTimeout(function() { 
            self.sendData('server-join', { users: self.users, request: { server: 'test' } }); 
        }, 50);
        setInterval(function() {
            let uid = util.pickInObject(self.users);
            const nonsense = ['lol','omg','discord','haha','...','yeah','no','wow','indeed','right','memes'];
            function sentenceBuilder(): string {
                let sentence = '';
                const wordCount = util.randomIntRange(1, 20);
                for(let i = 0; i < wordCount; i++) {
                    sentence += (i == 0 ? '' : ' ') + util.pickInArray(nonsense);
                }
                return sentence;
            }
            if(Math.random() > 0.8) {
                const status = util.pickInArray(['online','online','online','idle','offline']);
                self.users[uid].status = status;
                self.sendData('presence', {
                    uid: uid, status: status
                });
            } else {
                uid = self.randomUser({status:'online'}).user.id;
                self.sendData('message', {
                    uid: uid, message: sentenceBuilder(), channel: '10000000000'
                });
            }
        }, self.updateInterval);
    }

    sendData(type: string, data: any): void {
        this.emit('data', JSON.stringify({type: type, data: data}));
    }

    newUser(): User {
        let uid = '';
        for(let i = 0; i < 17; i++) { 
            uid += util.randomIntRange(0, 9); 
        }
        let name = '';
        const nameLength = util.randomIntRange(5, 9);
        for(let j = 0; j < nameLength; j++) {
            let letter: string = j & 1 ? util.pickInArray([...util.vowels]) : util.pickInArray([...util.consonants]);
            if(j == 0) letter = letter.toUpperCase();
            name += letter;
        }
        let avatar = '';
        for(let k = 0; k < 32; k++) { 
            avatar += util.pickInArray([...util.hex]); 
        }
        const isMute = Math.random() > 0.9;
        const user: User = {
            user: { 
                username: name, 
                id: uid, 
                discriminator: util.randomIntRange(1000, 9999), 
                avatar: avatar 
            },
            roles: Math.random() > 0.5 ? ['86919909468049408'] : [],
            mute: isMute,
            joined_at: '2015-0' + util.randomIntRange(1, 9) + '-' + util.randomIntRange(10, 28) + 'T0' +
                util.randomIntRange(1, 9) + ':' + util.randomIntRange(10, 59) + '.000000+00:00',
            deaf: isMute,
            game_id: null
        };
        if(Math.random() > 0.2) user.status = util.pickInArray(['online','online','online','idle','offline']);
        if(Math.random() > 0.9) user.game_id = util.randomIntRange(0, 585);
        return user;
    }

    randomUser(options: RandomUserOptions = {}): User {
        let safety = 0;
        let validChoice = false;
        let picked: User;
        do {
            picked = this.users[util.pickInObject(this.users)];
            validChoice = true;
            if(options.status) {
                validChoice = picked.status == options.status;
            }
            safety++;
        } while(safety < 100 && !validChoice);
        return picked;
    }
}