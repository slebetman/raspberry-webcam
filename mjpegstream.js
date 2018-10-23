#! /usr/bin/env node

var child_process = require('child_process');
var net = require('net');
var raspberryPiCamera = require('raspberry-pi-camera-native');

var BOUNDARY_STRING = '1234567890.a.very.unlikely.string.to.find.in.a.jpeg.file.0987654321';

raspberryPiCamera.start({
	width: 300,
	height: 200,
	fps: 15,
	quality: 30
},()=>{
	console.log('sending mjpeg stream');
});
raspberryPiCamera.pause();

var sock = null;

function stream () {
	raspberryPiCamera.on('frame', jpeg => {
		if (sock !== null && !sock.destroyed) {
			sock.write(
				'--' + BOUNDARY_STRING + "\r\n" +
				"Content-type: image/jpg\r\n" +
				"Content-length: " + jpeg.length + "\r\n" 
			);
			sock.write("\r\n");
			sock.write(jpeg);
		}
		else {
			raspberryPiCamera.pause();
		}
	});
	
	raspberryPiCamera.resume();
}

var server = net.createServer(conn => {
	var client = conn.remoteAddress;
	console.log('serving stream to ' + client);

	if (sock == null) {	
		sock = conn;
		
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
		
		stream(sock);
		
		sock.on('end', () => {
			sock = null;
			console.log(client + ' disconnected');
		});
		
		sock.on('error', () => {
			sock = null;
			console.log(client + ' disconnected');
		});
	}
	else {
		conn.end();
	}
});

server.on('error', err => console.error);

var  port = 8866;
server.listen(port, () => {
	console.log('server started on ' + port);
});
