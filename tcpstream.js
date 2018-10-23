#! /usr/bin/env node

var child_process = require('child_process');
var net = require('net');

var server = net.createServer(sock => {
	var client = sock.remoteAddress;
	console.log('serving stream to ' + client);
	
	var video = child_process.spawn('/usr/bin/raspivid',[
		'-t', '0',
		'-fps', '24',
		'-w', '1000',
		'-h', '680',
		'-o', '-'
	]);
	
	video.stdout.pipe(sock);
	
	sock.on('end', () => {
		console.log(client + ' disconnected');
		video.kill();
	});
	
	sock.on('error', () => {
		console.log(client + ' disconnected');
		video.kill();
	});
});

server.on('error', err => console.error);

server.listen(8899, () => {
	console.log('server started on 8899');
});
