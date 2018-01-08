// Create database for things.
var path = require('path');
var Datastore = require('nedb');
var db = new Datastore({ filename: path.join(process.cwd(), 'data.db'), autoload: true });

// Set variables and load modules
var crypto = require('crypto');
var net = require('net');
var JsonSocket = require('json-socket');
var socket = new JsonSocket(new net.Socket());

var RaiWallet = require('rai-wallet');
var Wallet = RaiWallet.Wallet;

// Configure RaiLightServer:

var port = 7077;
var host = '127.0.0.1';

// Connect to RaiLightServer (yes, will be decentralized, later)
function start() {
	socket.connect(port, host);
}
start();

// If can't connect, try again (and again.. again..)
socket.on('error', function() {
	setTimeout(start, 1000);
});

// On RaiLightServer sucess connection:
socket.on('connect', function() {
	// Get first BlockCount ;)
    socket.sendMessage({requestType: "getBlocksCount"});

//	socket.sendMessage({requestType: "getBalance", address: "xrb_39ymww61tksoddjh1e43mprw5r8uu1318it9z3agm7e6f96kg4ndqg9tuds4"});
//	socket.sendMessage({requestType: "getInfo", address: "xrb_39ymww61tksoddjh1e43mprw5r8uu1318it9z3agm7e6f96kg4ndqg9tuds4"});

	// Handle RaiLightServer responses
    socket.on('message', function(r) {
	// If BlocksCount
	if (r.type == "BlocksCount") {
		// Update on frontend
		$("#block").html("Block: "+r.count);
	} else {
		// Debug, for now.
		console.log(r);
	}
    });
});

// Get BrowserWindow.
const { remote } = require('electron');
const { BrowserWindow } = remote;

// Close the app on button close click
$("#closebtn").click(function() {
	var window = BrowserWindow.getFocusedWindow();
	window.close();
});

// Minimise the app on button close click
$("#minbtn").click(function() {
	var window = BrowserWindow.getFocusedWindow();
	window.minimize();
});

// Click on home, load a "default" page, for now.
$("#homebtn").click(function() {
	$("#content").html(
	`<div id="hello" style="text-align:  center;color: white;font-size: 80px;">Hello!</div>
		<p style="color:  white;margin-top: -5px;text-align:  center;">I am your new RaiBlocks wallet!</p>
		<p style="color: #e2ff00;font-size: 13px;text-align: center;font-weight:  normal;margin-top: -10px;">But i am a Work in Progress, come back later!</p>
		<br>
		<div class="createwallet">
			<span>Choose a password:</span>
			<form id="submit"><input type="password" id="mypassword"></form>
			<button id="create">Create!</button>
			<p id="created"></p>
        </div>
		<script>
		$("#create").click(function() {
			$("#created").html("Sorry, i am not ready to do this, yet ;(");
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
		</script>
		

	`);
});

// Dev stupid things, for testing.		
$("#submit").submit(function(e) {
    e.preventDefault();
    var test = $("#test").val();
	socket.sendMessage({msg: test});
});