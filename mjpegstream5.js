#! /usr/bin/env node

const net = require('net');
const P2J = require('pipe2jpeg');
const spawn = require('child_process').spawn;

var BOUNDARY_STRING = '1234567890.a.very.unlikely.string.to.find.in.a.jpeg.file.0987654321';

function defaultSettings () {
 return {
		width: '320',
		height: '240',
		bitrate: '1500000',
		framerate: '20',
		brightness: '60',
		contrast: '25',
		rotation: '180'
	}
}

let settings = defaultSettings();

function exitHandler () {
	server.close();
	configServer.close();
}

[
	'exit',
	'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
	'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(e => process.on(e, exitHandler));

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
					'--width',settings.width,
					'--height',settings.height,
					'--rotation',settings.rotation,
					'--bitrate',settings.bitrate,
					'--framerate',settings.framerate,
					'--codec','MJPEG',
					'--timeout','0',
					'--brightness',settings.brightness,
					'--contrast',settings.contrast,
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
	},
	closeAll: function () {
		this.camInstance.removeAllListeners('jpeg');
		this.openCount = 0;
		this.raspivid.stdout.destroy();
		this.raspivid = null;
		this.camInstance = null;
	}
}

function restartStream () {
	cam.closeAll();
	sockIds = Object.keys(socks);

	setTimeout(async function(){
		for (let i=0; i<sockIds.length; i++) {
			let camera = await cam.open();
			stream(socks[sockIds[i]], camera);
		}
	}, 1000);
}

function stream (sock,camera) {
	let transmitting = false;
	camera.on('jpeg', function mjpegStreamer (image) {
		if (!transmitting) {
			transmitting = true;
			sock.write(
				'--' + BOUNDARY_STRING + "\r\n" +
				"Content-type: image/jpg\r\n" +
				"Content-length: " + image.length + "\r\n" 
			);
			sock.write("\r\n");
			sock.write(image,
				err => {
					transmitting = false;
					if (err) {
						camera.removeListener('jpeg', mjpegStreamer);
						sock.destroy();
					}
				}
			);
		}
	});
}

let nextId = 0;
let socks = {};

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
	sock.id = nextId++;
	socks[sock.id] = sock;
	cam.open().then(camera => stream(sock,camera));
	
	sock.on('error', () => {});
	
	sock.on('close', () => {
		sock.isOpen = false;
		delete socks[sock.id];
		cam.close().then((x)=>console.log('raspivid ' + x)).catch(console.error);
		console.log(client + ' disconnected');
	});
});

server.on('error', err => console.error);

var  port = 8866;
server.listen(port, () => {
	console.log('server started on ' + port);
});

var configServer = net.createServer(sock => {
	sock.on('data', raw => {
		let json = JSON.parse(raw);
		switch (json.cmd) {
			case 'get':
				sock.write(JSON.stringify(settings));
				break;
			case 'set':
				for (let n in json.settings) {
					settings[n] = json.settings[n]; // update settings
				}
				restartStream();
				break;
			case 'defaults':
				settings = defaultSettings();
				restartStream();
				break;
		}
	});
});

var pipe = '/tmp/mjpegstream5';
configServer.listen(pipe, () => {
	console.log('config server started at ' + pipe);
});
