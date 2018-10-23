#! /usr/bin/env node

var net = require('net');
var piCamera = require('pi-camera-connect');

var BOUNDARY_STRING = '1234567890.a.very.unlikely.string.to.find.in.a.jpeg.file.0987654321';

var cam = {
	camInstance: null,
	openCount: 0,
	open: function () {
		console.log('open ' + (this.openCount + 1));
		if (this.camInstance === null) {
			this.camInstance = new piCamera.StreamCamera({
				width: 320,
				height: 240,
				fps: 20,
				bitRate: 2000000,
				codec: piCamera.Codec.MJPEG
			});
		}
		if (this.openCount == 0) {
			this.openCount++;
			console.log('starting camera');
			return this.camInstance.startCapture()
				.then(() => this.camInstance);
		}
		else {
			this.openCount++;
			return Promise.resolve(this.camInstance);
		}
	},
	close: function () {
		console.log('close ' + this.openCount);
		if (this.openCount > 0) {
			this.openCount--;
			if (this.openCount == 0) {
				console.log('stopping camera');
				return this.camInstance.stopCapture();
			}
			else {
				return Promise.resolve();
			}
		}
	}
}

function stream (sock,camera) {
	if (sock.isOpen) {
		camera.takeImage().then(image => {
			sock.write(
				'--' + BOUNDARY_STRING + "\r\n" +
				"Content-type: image/jpg\r\n" +
				"Content-length: " + image.length + "\r\n" 
			);
			sock.write("\r\n");
			sock.write(image,
				err => {
					if (!err) setTimeout(() => stream(sock,camera), 50);
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
	cam.open().then(camera => stream(sock,camera));
	
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
