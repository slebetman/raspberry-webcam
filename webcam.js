#! /usr/bin/env node

var Mjpeg = require('raspbian-mjpeg');
var basePath = '/media/adly/Maxtor/';

var server = new Mjpeg({
	statusFilePath: basePath + 'webcam.log',
	fifoFilePath: 'FIFO',
	mJpegFilePath: basePath + 'webcam.jpg',
	mediaFolder: basePath,
	fps: 15
});

server.setResolution({
	videoWidth: 320,
	videoHeight: 240
},function(){
	server.startCamera(function(){
		console.log('camera started');
	});
});