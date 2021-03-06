#! /usr/bin/env node

const net = require('net');
const P2J = require('pipe2jpeg');
const spawn = require('child_process').spawn;

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
				console.log('++');
				this.camInstance = new P2J();
				ok(this.camInstance);
				
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
				this.raspivid.on('error',console.error);
			}
			else {
				ok(this.camInstance);
			}
			console.log('openCount ' + this.openCount);
		});
	},
	close: function () {
		return new Promise((ok,fail) => {
			console.log('openCount ' + this.openCount);
			if (this.openCount > 0) {
				this.openCount--;
				if (this.openCount == 0) {
					this.raspivid.stdout.destroy();
					this.raspivid = null;
					this.camInstance = null;
					ok('closed');
				}
				else {
					ok('still running');
				}
			}
			else {
				ok('not running');
			}
		});
	}
}

function stream (sock,camera) {
	if (sock.isOpen) {
		camera.on('jpeg', function mjpegStreamer (image) {
			sock.write(
				'--' + BOUNDARY_STRING + "\r\n" +
				"Content-type: image/jpg\r\n" +
				"Content-length: " + image.length + "\r\n" 
			);
			sock.write("\r\n");
			sock.write(image,
				err => {
					if (err) {
						camera.removeListener('jpeg', mjpegStreamer);
						sock.destroy();
					}
				}
			);
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
		cam.close().then((x)=>console.log('raspivid ' + x)).catch(console.error);
		console.log(client + ' disconnected');
	});
});

server.on('error', err => console.error);

var  port = 8866;
server.listen(port, () => {
	console.log('server started on ' + port);
});
