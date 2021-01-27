/** Functionality related to chatting. */
const axios = require('axios');
// Room is an abstraction of a chat channel
const Room = require('./Room');

/** ChatUser is a individual connection from client -> server to chat. */

class ChatUser {
	/** make chat: store connection-device, rooom */

	constructor(send, roomName) {
		this._send = send; // "send" function for this user
		this.room = Room.get(roomName); // room user will be in
		this.name = null; // becomes the username of the visitor

		console.log(`created chat in ${this.room.name}`);
	}

	/** send msgs to this client using underlying connection-send-function */

	send(data) {
		try {
			this._send(data);
		} catch (e) {
			// If trying to send to a user fails, ignore it
		}
	}

	/** handle joining: add to room members, announce join */

	handleJoin(name) {
		this.name = name;
		this.room.join(this);
		this.room.broadcast({
			type : 'note',
			text : `${this.name} joined "${this.room.name}".`
		});
	}

	/** handle a chat: broadcast to room. */

	handleChat(text) {
		this.room.broadcast({
			name : this.name,
			type : 'chat',
			text : text
		});
	}

	/** Handle messages from client:
   *
   * - {type: "join", name: username} : join
   * - {type: "chat", text: msg }     : chat
   */

	handleMessage(jsonData) {
		let msg = JSON.parse(jsonData);

		if (msg.type === 'join') this.handleJoin(msg.name);
		else if (msg.type === 'chat') this.handleChat(msg.text);
		else if (msg.type === 'joke') this.getJoke();
		else if (msg.type === 'members') this.getMemberList();
		else if (msg.type === 'private') this.sendPrivate(msg.user, msg.text);
		else if (msg.type === 'name') this.changeName(msg.name);
		else throw new Error(`bad message: ${msg.type}`);
	}

	/** Gets a joke and sends to user */

	async getJoke() {
		let res = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'text/plain' } });
		let joke = res.data;
		this._send(JSON.stringify({ type: 'note', text: `Joke: ${joke}` }));
	}

	/** Gets list of members in chatroom and sends to user */

	getMemberList() {
		let mList = [ ...this.room.members ];
		let members = mList.map((m) => m.name).join(', ');
		this._send(JSON.stringify({ type: 'note', text: `Members: ${members}` }));
	}
	/** Sends private message to user */

	sendPrivate(user, text) {
		let member = [ ...this.room.members ].filter((m) => m.name === user);
		if (member.length === 0) {
			this._send(
				JSON.stringify({
					name : `${this.name} (private to ${user})`,
					type : 'chat',
					text : `Message not sent. The user ${user} is not in this chat room.`
				})
			);
		} else {
			this._send(
				JSON.stringify({
					name : `${this.name} (private to ${user})`,
					type : 'chat',
					text : text
				})
			);
			member[0]._send(
				JSON.stringify({
					name : `${this.name} (private)`,
					type : 'chat',
					text : text
				})
			);
		}
	}

	/** change name */

	changeName(name) {
		let oldName = this.name;
		let newName = name;
		this.room.broadcast({
			type : 'note',
			text : `<b>${oldName}</b> has changed their username to <b>${newName}</b>`
		});
		this.name = newName;
	}

	/** Connection was closed: leave room, announce exit to others */

	handleClose() {
		this.room.leave(this);
		this.room.broadcast({
			type : 'note',
			text : `${this.name} left ${this.room.name}.`
		});
	}
}

module.exports = ChatUser;
