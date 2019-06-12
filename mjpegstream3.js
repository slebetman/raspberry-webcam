#! /usr/bin/env node

var net = require('net');
// var piCamera = require('pi-camera-connect');
var piCamera = require('raspberry-pi-camera-native');

var BOUNDARY_STRING = '1234567890.a.very.unlikely.string.to.find.in.a.jpeg.file.0987654321';

var cam = {
	camInstance: null,
	openCount: 0,
	open: function () {
		return new Promise((ok,fail) => piCamera.start({
			width: 320,
			height: 240,
			fps: 20,
			encoding: 'JPEG',
			quality: 20
		},(err) => {
			if (err) fail(err);
			else ok();
		}));
	},
	close: function () {
		return new Promise((ok,fail) => piCamera.stop(() => ok()));
	}
}

function stream (sock) {
	if (sock.isOpen) {
		console.log('+');
		
		piCamera.on('frame', image => {
			sock.write(
				'--' + BOUNDARY_STRING + "\r\n" +
				"Content-type: image/jpg\r\n" +
				"Content-length: " + image.length + "\r\n" 
			);
			sock.write("\r\n");
			sock.write(image,
				err => {
					if (err) cam.close();
				}
			);
		})
	}
}

var server = net.createServer(sock => {
	var client = sock.remoteAddress;
	console.log('serving stream to ' + client);

	sock.write(
		"HTTP/1.0 200 OK\r\n" +
		"Max-Age: 0\r\n" +
		"Expires: 0\r\n" +
		"Cache-Control: no-cache, private\r\n" + 
		"Pragma: no-cache\r\n" + 
		"Content-Type: multipart/x-mixed-replace; " +
		"boundary=" + BOUNDARY_STRING + "\r\n"
	);
	
	sock.write("\r\n");

	sock.isOpen = true;	
	cam.open().then(() => stream(sock)).catch(console.log);
	
	sock.on('error', () => {});
	
	sock.on('close', () => {
		sock.isOpen = false;
		cam.close();
		console.log(client + ' disconnected');
	});
});

server.on('error', err => console.error);

var  port = 8866;
server.listen(port, () => {
	console.log('server started on ' + port);
});
