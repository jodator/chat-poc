'use strict';

const app = new Marionette.Application( {} );
const chatRooms = new ( Backbone.Collection.extend() )();
const user = new Backbone.Model();

app.rootView = new ( Marionette.LayoutView.extend( {
	el: '#app',
	regions: {
		chats: '#chats',
		activeChats: '#active-chat-rooms',
		user: '#user-id',
		currentChat: '#current-chat'
	}
} ) )();

const userView = new ( Marionette.ItemView.extend( {
	template: '#template-user',
	events: {
		'click button': function() {
			this.connect();
		},
		'submit form': function( evt ) {
			evt.preventDefault();
			evt.stopPropagation();

			this.connect();
		}
	},

	connect: function() {
		const username = this.$el.find( 'input' ).val().trim();

		if ( !username ) {
			alert( 'Set username!' );

			return;
		}

		user.set( 'name', username );

		this.disable();
		app.commands.execute( 'connect', user );
	},

	disable: function() {
		this.$el.find( 'button, input' ).attr( 'disabled', 'disabled' );
	},

	enable: function() {
		this.$el.find( 'button, input' ).removeAttr( 'disabled' );
	}
} ) )();

const activeChats = new ( Backbone.Collection.extend( {
	makeActive: function( chat ) {
		this.forEach( function( chat ) {
			chat.set( 'isActive', false );
		} );

		chat.set( 'isActive', true );
		if ( !chat.has( 'messages' ) ) {
			chat.set( 'messages', new Backbone.Collection() );
		}

		app.commands.execute( 'chat:active', chat );
	}
} ) )();

const activeChatRoomsView = new Marionette.CollectionView( {
	collection: activeChats,
	tagName: 'ul',
	className: 'nav nav-pills',
	childView: Marionette.ItemView.extend( {
		template: '#template-active-chat',
		tagName: 'li',
		className: '',
		events: {
			'click a': function() {
				this._parent.collection.makeActive( this.model );
				this._parent.render();
			}
		},
		onRender: function() {
			if ( this.model.get( 'isActive' ) ) {
				this.$el.addClass( 'active' );
			}
		}
	} )
} );

app.commands.setHandler( 'connect', function( user ) {
	let socket = io( 'ws://' + location.hostname + ':3001' );

	socket.on( 'hello', function( data ) {
		let chatRooms = [];

		data.chatRooms.forEach( ( name ) => {
			chatRooms.push( { name: name } );
		} );
		userView.disable();
		app.trigger( 'connected', { user: user, chatRooms: chatRooms } );
		console.log( 'Connected. ' + data.chatRooms.length + ' chats open.' );
	} );

	socket.on( 'joined', function( data ) {
		let chatRoom = chatRooms.find( { name: data.chatRoom.name } );

		activeChats.add( chatRoom );
		activeChats.makeActive( chatRoom );
		activeChatRoomsView.render();
	} );

	socket.on( 'chat:join', function( data ) {
		let chatRoom = chatRooms.find( { name: data.chat } );
		chatRoom.set( 'isOpen', true );

		if ( !chatRoom.has( 'messages' ) ) {
			chatRoom.set( 'messages', new Backbone.Collection() );
		}

		let messages = chatRoom.get( 'messages' );

		messages.push( _.extend( data, {
			user: false,
			time: formatTime( data.time ),
			msg: 'User ' + data.user + ' joined!'
		} ) );
	} );

	socket.on( 'chat:message', function( data ) {
		let chatRoom = chatRooms.find( { name: data.chat } );

		if ( !chatRoom.has( 'messages' ) ) {
			chatRoom.set( 'messages', new Backbone.Collection() );
		}

		if ( data.join ) {
			_.extend( data, {
				user: false,
				msg: 'User ' + data.user + ' joined!'
			} )
		}

		data.time = formatTime( data.time );

		chatRoom.get( 'messages' ).add( data );
	} );

	socket.on( 'disconnect', function() {
		activeChats.reset();
		app.rootView.$el.find( '#chats-views' ).hide();
		activeChatRoomsView.render();
		userView.enable();
	} );

	app.commands.setHandler( 'join', function( data ) {
		socket.emit( 'join', { chatRoom: data.chatRoom.toJSON(), user: user.get( 'name' ) } );
	} );

	app.commands.setHandler( 'chat:msg', function( data ) {
		socket.emit( 'chat:msg', { user: user.get( 'name' ), chat: data.chat, msg: data.msg } );
	} );

	socket.emit( 'hello', { name: user.get( 'name' ) } );
} );

app.on( 'connected', function() {
	app.rootView.$el.find( '#chats-views' ).show();
	app.rootView.activeChats.show( activeChatRoomsView );
} );

app.commands.setHandler( 'chat:active', function( chat ) {
	if ( !chat.has( 'messages' ) ) {
		chat.set( 'messages', new Backbone.Collection() );
	}

	let messages = chat.get( 'messages' );

	let activeChatView = new ( Marionette.CompositeView.extend( {
		template: '#template-current-chat',
		childViewContainer: '.chat-room',
		childView: Marionette.ItemView.extend( {
			template: '#template-chat-message',
			className: 'row'
		} ),
		events: {
			'click button': function() {
				this.submitChat();
			},
			'submit form': function( evt ) {
				evt.preventDefault();
				evt.stopPropagation();

				this.submitChat();
			}
		},
		initialize: function() {
			var that = this;
			this.listenTo( this.collection, 'add', function() {
				setTimeout( function() {
					var scrollable = that.$el.find( '.chat-room' ).get( 0 );
					scrollable.scrollTop = scrollable.scrollHeight;
					that.$el.find( 'input' ).focus();
				}, 10 );
			} );
		},
		onRender: function() {
			this._initialEvents();
		},
		submitChat: function() {
			let input = this.$el.find( 'input' );
			let text = input.val().trim();
			input.val( '' );
			if ( text ) {
				app.commands.execute( 'chat:msg', { chat: this.model, msg: text } );
			}
		}
	} ) )( { collection: messages, model: chat } );

	app.rootView.currentChat.show( activeChatView );
} );

app.on( 'connected', function( data ) {
	const chatRoomsView = new Marionette.CollectionView( {
		collection: chatRooms,
		className: 'chat-rooms',
		childView: Marionette.ItemView.extend( {
			template: '#template-chat',
			events: {
				'click button': function() {
					app.commands.execute( 'join', { chatRoom: this.model } )
				}
			}
		} ),
		collectionEvents: {
			'change:isOpen': function() {
				this.render();
			}
		},
		filter: function( child, index, collection ) {
			return !child.get( 'isOpen' );
		}
	} );

	chatRooms.reset( data.chatRooms );
	chatRoomsView.render();

	app.rootView.chats.show( chatRoomsView );
} );

app.rootView.user.show( userView );

app.start();

function formatTime( timeString ) {
	let time = new Date( timeString );
	return a( time.getHours() ) + ':' + a( time.getMinutes() ) + ':' + a( time.getSeconds() );

	function a( number ) {
		if ( number > 9 ) {
			return number;
		}

		return '0' + number;
	}
}
