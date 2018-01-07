var net = require('net'),
    JsonSocket = require('json-socket');

var port = 7077;
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket());
socket.connect(port, host);

socket.on('connect', function() {
    socket.sendMessage({requestType: "getBlocksCount"});
    socket.on('message', function(r) {
	if (r.type == "BlocksCount") {
		console.log(r.count);
	}
    });
});
socket.on('error', () => console.log('socket error'));