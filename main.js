// Create database for things.
var path = require('path');
var Datastore = require('nedb');
var db = new Datastore({ filename: path.join(process.cwd(), 'data.db'), autoload: true });

// Set variables and load modules
var cryptom = require('crypto');
var net = require('net');
var JsonSocket = require('json-socket');
var socket = new JsonSocket(new net.Socket());
var nacl = require(path.join(process.cwd(), 'src/js/nacl.js'));

// Get BrowserWindow.
const { remote } = require('electron');
const { BrowserWindow } = remote;

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

db.find({ type: 'wallet' }, function (err, docs) {
	if(docs && docs.length){
		$( document ).ready(function() {
			$( "#wallet1" ).removeClass('selected');
			$( "#wallet2" ).addClass('selected');
			$("#content").load( "pages/index.pg" );
		});
	} else {
		$( document ).ready(function() {
			$( "#wallet1" ).addClass('selected');
			$( "#wallet2" ).removeClass('selected');
			$("#content").load( "pages/create.pg");
		});		
	}
});

// EVENTS

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
/* $("#homebtn").click(function() {
	$("#content").html(
	`<div id="hello" style="text-align:  center;color: white;font-size: 80px;">Hello!</div>
		<p style="color:  white;margin-top: -5px;text-align:  center;font-size: 23px;">I am your new RaiBlocks wallet!</p>
		
		<br>
		<div class="createwallet">
			<span>Please, choose a strong password to create your wallet:</span>
			<form id="submit"><input type="password" id="mypassword"></form>
			<button id="create">Create!</button>
			<p id="created"></p>
        </div>
		<script>
		$("#create").click(function() {
			$("#created").html("Created!");
		});
		</script>
	`);
}); */

// FUNCTIONS

function encrypt(text, password){
  var cipher = cryptom.createCipher('aes-256-cbc',password);
  var crypted = cipher.update(text,'utf8','hex');
  crypted += cipher.final('hex');
  return crypted;
}

function decrypt(text, password){
  var decipher = cryptom.createDecipher('aes-256-cbc',password);
  var dec = decipher.update(text,'hex','utf8');
  dec += decipher.final('utf8');
  return dec;
}

// Dev stupid things, for testing.		
$("#submit").submit(function(e) {
    e.preventDefault();
    var test = $("#test").val();
	socket.sendMessage({msg: test});
});
