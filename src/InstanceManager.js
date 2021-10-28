const TheSoundBot = require('./TheSoundBot.js');
const config = require('./../config.js');
const Discord = require("discord.js");

class InstanceManager {
    
    constructor() {
        this.isDev = process.argv.includes("--dev");
        this.client = new Discord.Client();
        this.sessions = new Map();
    }

    _onVoiceStateUpdate(oldState, newState) {
        const guildId = newState.guild.id;
        const thesoundbot = this.sessions.get(guildId);

        if (thesoundbot) {
            thesoundbot.onVoiceStateUpdate(oldState, newState)
        }
        
    }

    _onMessage(msg) {
        const guildId = msg.guild.id;
        const thesoundbot = this.sessions.get(guildId);
        
        if (thesoundbot) {
            thesoundbot.onMessage(msg)
        }
    }

    _initSessions() {
        if (!this.sessions.size) {
            for (const [key, value] of this.client.guilds.cache.entries()) {
                this.sessions.set(key, new TheSoundBot(value));
            }
        }
    }

    _initSession(guild) {
        this.sessions.set(guild.id, new TheSoundBot(guild));
    }

    _setActivity() {
        this.client.user.setActivity(
            `tsu help`, {type: 'PLAYING'}
        );
    }

    _setEvents() {
        this.client.on("ready", () => {
            console.log(`Logged in as ${this.client.user.tag}, id ${this.client.user.id}!`);

            this._setActivity();
            this._initSessions();
          });
          
        this.client.on(
            "voiceStateUpdate", (oldState, newState) => this._onVoiceStateUpdate(oldState, newState)
        );
          
        this.client.on(
            "message", msg => this._onMessage(msg)
        );

        this.client.on(
            "guildCreate", guild => this._initSession(guild)
        );
    }

    init() {
        if (this.isDev) {
            this.client.login(config.TOKEN_DEV);
        } else {
            this.client.login(config.TOKEN_PROD);
        }

        this._setEvents();
    }

}

module.exports = InstanceManager;