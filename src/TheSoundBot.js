const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("discord-ytdl-core");
const ytpl = require('ytpl');
const keepAlive = require('./../server.js');

if (process.env['REPLIT']) {
  (async () => keepAlive())();
}

class TheSoundBot {
  constructor(guild) {
    this.youtubeChannel = "https://www.youtube.com/c/thesoundunique";
    this.prefix = "tsu";
    this.guild = guild;
    this.autoJoinChannelNames = ["TSU", "YouTube"];
    this.queue = new Map();
    this.emptyVideo = "https://www.youtube.com/watch?v=kvO_nHnvPtQ";
    this.playlists = {
      nocopyright: "https://www.youtube.com/playlist?list=PLxdqsLxANwLlCOtwD7n78uuRhv3nqwL_E",
      edm: "https://www.youtube.com/playlist?list=PLxdqsLxANwLkiotoi5C1FqrRQ-wvaVJ8b",
      trap: "https://www.youtube.com/playlist?list=PLxdqsLxANwLkla2FJu3nE_7e3QpK1E-aN"
    }
  }

  timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _connectToVoice(msg, isAutoJoin) {
    const channelID = msg.member.voice.channelID;
    const channel = this.guild.channels.cache.get(channelID);

    if (!channelID) {
      return msg.channel.send("Per invitarmi entra prima nella voice chat.");
    }

    const permissions = channel.permissionsFor(msg.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return msg.channel.send(
        "Ho bisogno di permessi per connettermi a questa voice chat."
      );
    } else if (!channel) {
      return console.error("The channel does not exist!");
    } else {
      channel.join().then(connection => {
        this.connection = connection;
        this.connection.play(ytdl(this.emptyVideo,
        {
          filter: "audioonly",
          fmt: "mp3"
        }))
        console.log("Successfully connected.");

        if (isAutoJoin) {
          this._startPlaylist(msg, this.playlists.nocopyright, true, isAutoJoin);
        }

      }).catch(e => {
        console.error(e);
      });
    }

  }

  _disconnectFromVoice(msg) {
    if(!msg.guild.me.voice.channel) return msg.channel.send("Non sono in un canale.");

    msg.guild.me.voice.channel.leave();
  }

  _skip() {
    this.dispatcher.emit("finish");
  }

  _sendSongTitle(song) {
    ytdl.getBasicInfo(song).then(async info => {
      const embed = new Discord.MessageEmbed()
      .setColor('#0099ff')
      .setTitle(`🎵 ${info.videoDetails.title}`)
      .setURL(song);
    
      if (this.songTitleMessage) {
        this.songTitleMessage.edit(embed);
      } else {
        this.songTitleMessage = await this.serverQueue.textChannel.send(embed);
      }

    });
  }

  _handleYoutube403(guild) {
    //Trying to play the failed song after waiting a while.
    console.log("Playback failed, retrying...");

    this.timeout(250).then(
      () => this._play(guild)
    )
  }

  _handleGoogleConnectionRefused(guild) {
    console.log("Connection refused, retrying...");

    this.timeout(1000).then(
      () => this._play(guild)
    )
  }

  _handlePlayError(error, guild) {
    console.log("Error caught in the voice connection.");
    console.error(error); 

    if (error.statusCode === 403) this._handleYoutube403(guild);
    if (error.code === 'ECONNREFUSED') this._handleGoogleConnectionRefused(guild);
  } 


  _play(guild) {
    const currentSong = this.serverQueue.songs[0];

    if (!currentSong) {
      this.serverQueue.voiceChannel.leave();
      this.queue.delete(guild.id);
      return;
    }

    console.log(`Playing song: ${currentSong}`);

    const stream = ytdl(currentSong, {
      filter: "audioonly",
      fmt: "mp3"
    });

    if (this.connection) {
      this.dispatcher = this.connection
      .play(stream)
      .on("finish", () => {
          this.serverQueue.songs.shift();
          this._play(guild);
      })
      .on("error", error => this._handlePlayError(error, guild));

      if (this.serverQueue.textChannel) {
        this._sendSongTitle(currentSong);
      }
      
      this.dispatcher.setVolumeLogarithmic(this.serverQueue.volume / 5);
    } else {
      console.log("Connection is undefined.")
      this.serverQueue.voiceChannel.leave();
    }
  }

  _shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }

  _startPlaylist(msg, playlistURL, shuffle, isAutoJoin) {
    ytpl(playlistURL).then(
      (playlist) => {
        console.log("Playing playlist...");
        const queueConstruct = {
          textChannel: isAutoJoin ? "" : msg.channel,
          voiceChannel: msg.member.voice.channel,
          connection: this.connection,
          songs: [],
          volume: 5,
          playing: true,
        };
        
        this.queue.set(msg.guild.id, queueConstruct);

        let playlistItems = playlist.items;

        if (shuffle) {
          playlistItems = this._shuffle(playlist.items)
        }
        
        for (let item of playlistItems) {
          queueConstruct.songs.push(item.shortUrl);
        }

        this.serverQueue = this.queue.get(msg.guild.id);
        this._play(msg.guild);
      }
    );
  }

  _interceptPlayCommand(splitCommand, msg, shuffle) {
    let playlist = this.playlists[splitCommand[2]];

    if(!msg.guild.me.voice.channel) {
      msg.channel.send("Non sono in un canale.");
    } else if (playlist) {
      this._startPlaylist(msg, playlist, shuffle);
    }
  }

  _parseCommand(msg) {
    let content = msg.content.toLowerCase();
    const usage = `
    \`\`\`
Utilizzo:
tsu [help | [join | start] | skip | stop |\n    play <playlist> | shuffle <playlist>] 
\`\`\`
    `
    const embed = new Discord.MessageEmbed()
    .setColor('#0099ff')
    .setTitle("The Sound Unique")
    .setURL(this.youtubeChannel)
    .setDescription(usage)
    .setThumbnail('https://i.imgur.com/LyFIUIW.png')
    .addFields(
      { name: 'help', value: 'Mostra questo messaggio.', inline: true },
      { name: 'join | start', value: 'Unisce il bot alla chat vocale.', inline: true },
      { name: 'skip', value: 'Skippa la riproduzione del brano.', inline: true },
      { name: 'stop', value: 'Ferma il bot.', inline: true },
      { name: 'play', value: 'Riproduce la playlist in ordine.', inline: true },
      { name: 'shuffle', value: 'Riproduce i brani della playlist in modo casuale.', inline: true },
      { name: 'Playlists:', value: 'Trap\nEDM\nNocopyright\n' },
      { name : 'Autojoin:', value: `Il bot viene aggiunto automaticamente al canale vocale "${this.autoJoinChannelNames[0]}" o "${this.autoJoinChannelNames[1]}" appena un utente entra.`}
    )
    .setFooter('Author: Barretta', 'https://i.imgur.com/4Ff284Z.jpg');

    const splitCommand = content.split(" ");

    if (splitCommand[0].includes(this.prefix)) {
      switch (splitCommand[1]) {
        case "join":
        case "start": 
          this._connectToVoice(msg);
        break;
        case "skip":
          this._skip();
        break;
        case "stop":
          this._disconnectFromVoice(msg);
        break;
        case "play":
          this._interceptPlayCommand(splitCommand, msg);
        break;
        case "shuffle": 
          this._interceptPlayCommand(splitCommand, msg, true);
        break;
        case "help":
          msg.reply(embed);
        break;
      }
    }
  }

  onMessage(msg) {
    if (!msg.author.bot) {
      this._parseCommand(msg);
    }
    
  }

  _shouldLeaveChannel(oldState) {
    let amIAlone;

    if (oldState.channel) {
      const amIInChannel = oldState.channel.members.get(this.guild.client.user.id);
      const members = [...oldState.channel.members];
      
      const humans = members.filter(member => {
       const isNotBot = !member[1].user.bot;
  
       return isNotBot;
      });

      amIAlone = !humans.length && amIInChannel;
    } else {
      amIAlone = false;
    }

    return amIAlone;
  }

  _notInAVoiceChannel() {
    let notInAVoiceChannel;

    if (this.guild.voice && this.guild.voice.connections) {
      notInAVoiceChannel = this.guild.voice.connections.size <= 0;
    } else {
      notInAVoiceChannel = true;
    }

    return notInAVoiceChannel;
  }

  _isAutoJoinChannelName(name) {
    const matchAutoJoinChannels = new RegExp(this.autoJoinChannelNames.join("|"), 'gi');
    const isAutoJoinChannelName = name.match(matchAutoJoinChannels);

    return isAutoJoinChannelName;
  }

  _tryJoinVoiceChannel(newState) {
    let isAutoJoinChannelName;

    if (newState.channel !== null) {
      isAutoJoinChannelName = this._isAutoJoinChannelName(newState.channel.name);
    }

    const notInAVoiceChannel = this._notInAVoiceChannel();
    const isNotBot = !newState.member.user.bot;

    if (isAutoJoinChannelName && notInAVoiceChannel && isNotBot) {
      this._connectToVoice(newState, true);
    }
  }

  _tryLeaveVoiceChannel(oldState) {
    const shouldLeave = this._shouldLeaveChannel(oldState);

    if (shouldLeave && this.serverQueue) {
      this.serverQueue.voiceChannel.leave();
    }
  }

  onVoiceStateUpdate(oldState, newState) {
    this._tryJoinVoiceChannel(newState);
    this._tryLeaveVoiceChannel(oldState);
  }

}

module.exports = TheSoundBot;