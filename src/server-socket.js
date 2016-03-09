'use strict';

const Hapi = require( 'hapi' );

// Hapi server
const server = new Hapi.Server();

server.connection( { port: 3001, labels: [ 'chat' ] } );

// Socket IO
const io = require( 'socket.io' )( server.select( 'chat' ).listener );

// Redis Pub/Sub
const redis = require( 'redis' );
const pub = redis.createClient();
const sub = redis.createClient();

const CHAT_ROOMS = 'chatRooms';

//Create sample chat rooms
//for ( let i = 1; i <= 10; i++ ) {
//	pub.sadd( CHAT_ROOMS, 'Chat room ' + i );
//}

server.start( ( err )=> {
	if ( err ) {
		throw err;
	}

	// Show each connection
	server.connections.forEach( ( connection )=> {
		console.log( 'Server', connection.settings.labels.join( '-' ), 'running at:', connection.info.uri );
	} );
} );

sub.on( 'message', function( channel, message ) {
	let data = JSON.parse( message );
	let chatRoom = data.chat;

	pub.smembers( 'chat:connections:' + chatRoom, ( dunno, socketIds ) => {
		socketIds.forEach( ( socketId ) => {
			if ( io.sockets.connected[ socketId ] ) {
				if ( channel === 'chat:join' ) {
					io.sockets.connected[ socketId ].emit( 'chat:join', { user: data.user, chat: chatRoom, time: data.time } );
				} else {
					io.sockets.connected[ socketId ].emit( 'chat:message', {
						user: data.user,
						chat: chatRoom,
						time: data.time,
						msg: data.msg
					} );
				}
			}
		} );
	} );

} );

io.on( 'connection', ( socket ) => {
	socket.on( 'hello', () => {
		pub.smembers( CHAT_ROOMS, ( dunno, chatRooms ) => {
			socket.emit( 'hello', { chatRooms: chatRooms } );
		} );
	} );

	socket.on( 'join', ( data ) => {
		pub.sadd( 'chat:connections:' + data.chatRoom.name, socket.id );
		pub.sadd( 'user:chats:' + socket.id, data.chatRoom.name );
		socket.emit( 'joined', { chatRoom: data.chatRoom, user: data.user } );
		let message = JSON.stringify( {
			user: data.user,
			chat: data.chatRoom.name,
			time: new Date(),
			join: true
		} );

		pub.lrange( 'chat:archive:' + data.chatRoom.name, -5, -1, ( dunno, messages ) => {
			messages.forEach( ( message )=> {
				socket.emit( 'chat:message', JSON.parse( message ) );
			} );
			pub.rpush( 'chat:archive:' + data.chatRoom.name, message );
			pub.publish( 'chat:join', message );
		} );
	} );

	socket.on( 'disconnect', () => {
		pub.smembers( 'user:chats:' + socket.id, ( dunno, chatRooms ) => {
			chatRooms.forEach( ( chatRoom )=> {
				pub.srem( 'chat:connections:' + chatRoom, socket.id );
			} );
		} );
		pub.del( 'user:chats:' + socket.id );
	} );

	socket.on( 'chat:msg', ( data )=> {
		let message = JSON.stringify( {
			user: data.user,
			chat: data.chat.name,
			time: new Date(),
			msg: data.msg
		} );
		// archive
		pub.rpush( 'chat:archive:' + data.chat.name, message );
		// publish
		pub.publish( 'chat:message', message );
	} );
} );

sub.subscribe( 'chat:message' );
sub.subscribe( 'chat:join' );
