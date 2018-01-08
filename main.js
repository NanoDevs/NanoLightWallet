var Datastore = require('nedb');
var path = require('path');
var db = new Datastore({ filename: path.join(process.cwd(), 'data.db'), autoload: true });
var net = require('net');
var JsonSocket = require('json-socket');
var crypto = require('crypto');
var RaiWallet = require('rai-wallet');
var Wallet = RaiWallet.Wallet;

var port = 7077;
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket());

function start() {
	socket.connect(port, host);
}
start();

$("#create").click(function() {
	$("#created").html("Sorry, i'm not ready to do this, yet ;(");
});

$("#button2").click(function() {
	var seed = uint8_hex(nacl.randomBytes(32));
      $("#test4").val(seed);
	
	  var index = hex_uint8(dec2hex(1, 4));
	  var context = blake2bInit(32);
	  blake2bUpdate(context, seed);
	  blake2bUpdate(context, index);

	  var newKey = blake2bFinal(context);
	  var secret = uint8_hex(newKey);
	  var address = accountFromHexKey(uint8_hex(nacl.sign.keyPair.fromSecretKey(newKey).publicKey));
	  console.log(address);
	  $("#test3").html(address);
});

$("#submit").submit(function(e) {
    e.preventDefault();
    var test = $("#test").val();
	socket.sendMessage({msg: test});
});

socket.on('connect', function() {
    socket.sendMessage({requestType: "getBlocksCount"});
//	socket.sendMessage({requestType: "getBalance", address: "xrb_39ymww61tksoddjh1e43mprw5r8uu1318it9z3agm7e6f96kg4ndqg9tuds4"});
//	socket.sendMessage({requestType: "getInfo", address: "xrb_39ymww61tksoddjh1e43mprw5r8uu1318it9z3agm7e6f96kg4ndqg9tuds4"});
    socket.on('message', function(r) {
	if (r.type == "BlocksCount") {
		$("#block").html("Block: "+r.count);
	} else {
		console.log(r);
	}
    });
});
socket.on('error', function() {
	setTimeout(start, 1000);
});