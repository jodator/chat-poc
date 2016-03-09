'use strict';

const Hapi = require( 'hapi' );

// Hapi server
const server = new Hapi.Server();

server.connection( { port: 3000, labels: [ 'api' ] } );

server.start( ( err )=> {
	if ( err ) {
		throw err;
	}

	// Show each connection
	server.connections.forEach( ( connection )=> {
		console.log( 'Server', connection.settings.labels.join( '-' ), 'running at:', connection.info.uri );
	} );
} );

// Serve static contents
server.register( require( 'inert' ), ( err ) => {
	if ( err ) {
		throw err;
	}

	server.route( {
		method: 'GET',
		path: '/',
		handler: ( request, reply ) => {
			reply.file( './../public/index.html' );
		}
	} );

	server.route( {
		method: 'GET',
		path: '/js/{param*}',
		handler: ( request, reply ) => {
			reply.file( './../public/js/' + request.params.param )
		}

	} )
} );

