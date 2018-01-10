// Set variables and load modules
var path = require('path');
var db = require('./src/js/db.js');
var cryptom = require('crypto');
var net = require('net');
var JsonSocket = require('json-socket');
var socket = new JsonSocket(new net.Socket());
var nacl = require('./src/js/lib/nacl.js');
var BigNumber = require('bignumber.js');
var bigInt = require("big-integer");
var https = require('https');
var balance;
var price;
var wallet;
var walletloaded = false;
var myaddress;

// Get BrowserWindow.
const {remote} = require('electron');
const {BrowserWindow} = remote;

var RaiWallet  = require('./src/js/rai-wallet/Wallet');
var Block = require('./src/js/rai-wallet/Block');

// Configure RaiLightServer:

var port = 7077;
var host = '127.0.0.1';

// WALLET LOAD
BrowserWindow.getAllWindows()[0].show();
db.getWallet(function (exists, pack) {
	if (exists) {
		$("#content").load( "pages/login.pg" );
		$( "#wallet1" ).removeClass('selected');
		$( "#wallet2" ).addClass('selected');
	} else {
		$(document).ready(function() {
			$("#wallet1").addClass('selected');
			$("#wallet2").removeClass('selected');
			$("#content").load("pages/create.pg");
		});
	}
});

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
	walletLoaded(function (){
		console.log("connected registered");
		socket.sendMessage({requestType: "registerAddresses", addresses: [myaddress]});
	});
	// Get first BlockCount ;)
    socket.sendMessage({requestType: "getBlocksCount"});
//	socket.sendMessage({requestType: "getBalance", address: "xrb_39ymww61tksoddjh1e43mprw5r8uu1318it9z3agm7e6f96kg4ndqg9tuds4"});
//	socket.sendMessage({requestType: "getInfo", address: "xrb_39ymww61tksoddjh1e43mprw5r8uu1318it9z3agm7e6f96kg4ndqg9tuds4"});
//  socket.sendMessage({requestType: "getPendingBlocks", addresses: ["xrb_1ce75trhhmqxxmpe3cny93eb3niacxwpx85nsxricrzg6zzbaz4j9zoss59n"]});

	// Handle RaiLightServer responses
    socket.on('message', function(r) {
	// If BlocksCount
		if (r.type == "BlocksCount") {
			// Update on frontend
			$("#block").html("Block: "+r.count);
		} else if (r.type == "PendingBlocks") {
			// Add pending blocks to PoW
			Object.keys(r.blocks).forEach(function(account){
				Object.keys(r.blocks[account]).forEach(function(hash){
					console.log( hash );
					console.log( account );
					console.log( r.blocks[account][hash].source);
					console.log( r.blocks[account][hash].amount);
					try {
						wallet.addPendingReceiveBlock(hash, account, r.blocks[account][hash].source, r.blocks[account][hash].amount);
					}
					catch(err) {
						console.log(err);
					}
				});
			});
			//socket.sendMessage({requestType: "getPendingBlocks", addresses: ["xrb_1ce75trhhmqxxmpe3cny93eb3niacxwpx85nsxricrzg6zzbaz4j9zoss59n"]});
		} else if (r.type == "balanceUpdate") {
			walletLoaded(function () {
				socket.sendMessage({requestType: "getPendingBlocks", addresses: [r.address]});
			});

		} else {
			// Debug, for now.
			console.log(r);
		}
    });
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


$("#homebtn").click(function() {
	db.getWallet(function (exists, pack) {
		if (exists) {
			$("#wallet1").removeClass('selected');
			$("#wallet2").addClass('selected');
			$("#content").load( "pages/index.pg" );
		} else {
			$("#wallet1").addClass('selected');
			$("#wallet2").removeClass('selected');
			$("#content").load("pages/create.pg");
		}
	});
});

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

function walletLoaded(cb) {
	if (walletloaded) {
		cb();
	} else {
		setTimeout(walletLoaded, 100, cb);
	}
}

// LOCAL POW

function clientPoW() {
	
	var pool = wallet.getWorkPool();

	var hash = false;
	if(pool.length > 0) {
		for(let i in pool) {
			if(pool[i].needed ||!pool[i].requested) {
				hash = pool[i].hash;
				break;
			}
		}
		if(hash === false) {
			return setTimeout(clientPoW, 1000);
		}
		pow_workers = pow_initiate(NaN, 'src/js/pow/');
		pow_callback(pow_workers, hash, function() {
			console.log('Working locally on ' + hash);
		}, function(work) {
			console.log('PoW found for ' + hash + ": " + work);
			wallet.updateWorkPool(hash, work);
			setTimeout(clientPoW, 1000);
		});
	} else {
		setTimeout(clientPoW, 1000);
	}
}

function checkReadyBlocks(){
	var blk = wallet.getNextReadyBlock();
	if(blk !== false)
		broadcastBlock(blk);
	setTimeout(checkReadyBlocks, 1500);
}

function broadcastBlock(blk){
	var json = blk.getJSONBlock();
	var hash = blk.getHash(true);
	console.log(hash);
	var guiHash;
	if(blk.getType() == 'open' || blk.getType() == 'receive')
		guiHash = blk.getSource();
	else
		guiHash = blk.getHash(true);
	
    socket.sendMessage({requestType: "processBlock", block: json});
    socket.on('message', function(r) {
		if (r.type == "processResponse") {
			wallet.removeReadyBlock(hash);
		}
	});
}

function checkChains(cb) {
	var accs = wallet.getAccounts();
	var r = {};
	for (var i in accs) {
		if (accs[i].lastHash === false) r.push(accs[i].account);
	}

	socket.sendMessage({requestType: "getChain", address: myaddress, count: "100"});
	//socket.sendMessage({requestType: "getChain", address: "xrb_1ce75trhhmqxxmpe3cny93eb3niacxwpx85nsxricrzg6zzbaz4j9zoss59n", count: "50"});
    socket.on('message', function(r) {
		if (r.type == "Chain") {
			var blocks = r.blocks;
			
			if(blocks) {
				index = Object.keys(blocks);
				index.reverse();
				
				index.forEach(function(val, key){
					try{
						var blk = new Block();
						blk.buildFromJSON(blocks[val].contents);
						blk.setAccount(myaddress);
						blk.setAmount(blocks[val].amount);
						blk.setImmutable(true);
						wallet.importBlock(blk, myaddress, false);
					}catch(e){
						console.log(e);
					}

				});
				setTimeout(checkReadyBlocks, 1000);
				wallet.useAccount(myaddress);
				cb();
				
			} else {
				setTimeout(checkReadyBlocks, 1000);
				cb();
			}
			

		}
	});
}


// Dev stupid things, for testing.		
$("#submit").submit(function(e) {
	e.preventDefault();
	var test = $("#test").val();
	socket.sendMessage({msg: test});
});