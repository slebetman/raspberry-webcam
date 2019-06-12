#! /usr/bin/env node

var net = require('net');
var P2J = require('pipe2jpeg');
var spawn = require('child_process').spawn;

var BOUNDARY_STRING = '1234567890.a.very.unlikely.string.to.find.in.a.jpeg.file.0987654321';

var cam = {
	camInstance: null,
	raspivid: null,
	openCount: 0,
	jpeg: null,
	open: function () {
		this.openCount++;
		console.log('open ' + (this.openCount));
		
		return new Promise((ok,fail) => {
			if (this.camInstance === null) {
				this.camInstance = new P2J();
				this.camInstance.on('jpeg', picture => {
					if (this.jpeg == null) {
						this.jpeg = picture;
						ok(this.camInstance);
					}
					else {
						this.jpeg = picture;
					}
				});
				this.raspivid = spawn('raspivid',[
					'--width','320',
					'--height','240',
					'--rotation','180',
					'--bitrate','600000',
					'--framerate','10',
					'--codec','MJPEG',
					'--timeout','0',
					'--brightness','60',
					'--contrast','25',
					'--drc','high',
					'--nopreview',
					'--output','-'
				],{
					stdio:['ignore','pipe','ignore']
				});
				
				this.raspivid.stdout.pipe(this.camInstance);
			}
			else {
				ok(this.camInstance);
			}
		});
	},
	close: function () {
		if (this.openCount > 0) {
			this.openCount--;
			// if (this.openCount == 0) {
			// 	this.raspivid.kill();
			// 	this.raspivid = null;
			// 	this.camInstance = null;	
			// }
		}
		return Promise.resolve();
	}
}

function stream (sock,camera) {
	if (sock.isOpen) {
		camera.on('jpeg', image => {
		// let image = cam.jpeg;
		// if (image !== null) {
			sock.write(
				'--' + BOUNDARY_STRING + "\r\n" +
				"Content-type: image/jpg\r\n" +
				"Content-length: " + image.length + "\r\n" 
			);
			sock.write("\r\n");
			sock.write(image,
				err => {
					// if (!err) setTimeout(() => stream(sock), 50);
				}
			);
		// }
		// else {
		// 	setTimeout(() => stream(sock), 50);
		// }
		});
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
