// Load modules
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
var RaiWallet = require('./src/js/rai-wallet/Wallet');
var Block = require('./src/js/rai-wallet/Block');

// Get BrowserWindow.
const {remote} = require('electron');
const {BrowserWindow} = remote;

// Configure RaiLightServer:

var port = 7077;
var host = '127.0.0.1';

// Load default (and global) variables:
var wallet;
var accounts;
var addresses = [];
var balance;
var price;
var walletloaded = false;
var myaddress;
var txhistory;
var currentPage;

// WALLET LOAD
db.getWallet(function(exists, pack) {
	BrowserWindow.getAllWindows()[0].show();
	if (exists) {
		$("#content").load("pages/login.pg");
		$( "#wallet2" ).addClass('visible');
		$( "#wallet2" ).addClass('selected');
	} else {
		$(document).ready(function() {
			//$("#wallet1").addClass('selected');
			//$("#wallet2").removeClass('selected');
			$("#content").load("pages/create.pg");
			$( "#wallet1" ).addClass('visible');
			$( "#wallet1" ).addClass('selected');
		});
	}
});

// Connect to RaiLightServer (yes, will be decentralized, later)
function startConnection() {
	socket.connect(port, host);
}
startConnection();

// If can't connect, try again (and again.. again..)
socket.on('error', function() {
	setTimeout(startConnection, 1000);
});

// On RaiLightServer connection
socket.on('connect', function() {
	console.log("Connected to the default server!");
	// Sure it will run after the wallet is loaded
	walletLoaded(function (){
		var accounts = wallet.getAccounts();
		// Push all addresses to array
		for(let i in accounts) {
			addresses.push(accounts[i].account);
		}
		console.log(accounts);
		// Register all addresses to get nearly instant notification about new balances ;)
		socket.sendMessage({requestType: "registerAddresses", addresses: addresses});
	});
	// Get first Blocks Count
    socket.sendMessage({requestType: "getBlocksCount"});

	// Handle RaiLightServer responses
    socket.on('message', function(r) {
		// If BlocksCount
		if (r.type == "BlocksCount") {
			// Update on GUI
			$("#block").html("Block: "+r.count);
		// If BalanceUpdate or Balance (deprecated)
		} else if (r.type == "balanceUpdate" || r.type == "Balance") {
			// Sure it will run after the wallet is loaded
			walletLoaded(function () {
				// Get PendingBlocks to PoW ;)
				socket.sendMessage({requestType: "getPendingBlocks", addresses: addresses});
				// Set balance;
				balance = new BigNumber(r.balance).dividedBy('1e+30');
				wallet.setAccountBalancePublic(r.balance, addresses[0]);
				// Set transaction history
				txhistory = wallet.getLastNBlocks(parseXRBAccount(addresses[0]), 100, 0);
			});

		} else if (r.type == "PendingBlocks") {
			// Add pending blocks to PoW
			Object.keys(r.blocks).forEach(function(account){
				Object.keys(r.blocks[account]).forEach(function(hash){
					try {
						wallet.addPendingReceiveBlock(hash, account, r.blocks[account][hash].source, r.blocks[account][hash].amount);
					// Catch error, for debug
					} catch(e) {console.log(err);}
				});
			});
			
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

$("#sendbtn").click(function() {
	if (walletloaded) {
		$("#content").empty();
		$("#content").load("pages/send.pg");
	}
});

$("#homebtn").click(function() {
	if (walletloaded) {
		$("#content").empty();
		$("#content").load("pages/index.pg");
	}
});

// FUNCTIONS

// Encrypt using aes-256-cbc
function encrypt(text, password){
	var cipher = cryptom.createCipher('aes-256-cbc',password);
	var crypted = cipher.update(text,'utf8','hex');
	crypted += cipher.final('hex');
	return crypted;
}

// Decrypt using aes-256-cbc
function decrypt(text, password){
	var decipher = cryptom.createDecipher('aes-256-cbc',password);
	var dec = decipher.update(text,'hex','utf8');
	dec += decipher.final('utf8');
	return dec;
}

// Sure it will run after the wallet is loaded
function walletLoaded(cb) {
	if (walletloaded) {
		cb();
	} else {
		setTimeout(walletLoaded, 100, cb);
	}
}

// Broadcast blocks to the network
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

// Local PoW
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
			return setTimeout(clientPoW, 200);
		}
		pow_workers = pow_initiate(NaN, 'src/js/pow/');
		pow_callback(pow_workers, hash, function() {
			console.log('Working locally on ' + hash);
		}, function(work) {
			console.log('PoW found for ' + hash + ": " + work);
			wallet.updateWorkPool(hash, work);
			setTimeout(clientPoW, 200);
			checkReadyBlocks();
			txhistory = wallet.getLastNBlocks(parseXRBAccount(addresses[0]), 100, 0);
			function checkReadyBlocks(){
				var blk = wallet.getNextReadyBlock();
				if(blk !== false) {
					broadcastBlock(blk);
				} else {
					setTimeout(checkReadyBlocks, 500);
				}
			}
		});
	} else {
		setTimeout(clientPoW, 200);
	}
}


function checkChains(cb) {
	var check = {};
	for (var i in accounts) {
		if (accounts[i].lastHash === false) check.push(accounts[i].account);
		console.log(accounts[i].account);
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
				wallet.useAccount(myaddress);
				cb();
				
			} else {
				cb();
			}
			

		}
	});
}

function getPrice() {
	https.get('https://api.coinmarketcap.com/v1/ticker/raiblocks/', (res) => {
		let body = "";
		res.on("data", data => {
			body += data;
		});  
		res.on("end", () => {
			body = JSON.parse(body);
			price = body[0].price_usd;
			setTimeout(getPrice, 10000);
		 });
	});
}
getPrice();


// Dev stupid things, for testing.		
$("#submit").submit(function(e) {
	e.preventDefault();
	var test = $("#test").val();
	socket.sendMessage({msg: test});
});