var Datastore = require('nedb');
var dbfile = new Datastore({filename: path.join(process.cwd(), 'data.db'), autoload: true});

var createWallet = exports.createWallet = function createWallet(seed, pack) {
	dbfile.insert([{ type: 'wallet', seed: seed, pack: pack }], function (err, doc) {
		if (err) {
			console.log(err);
		}
	});
};

var saveWallet = exports.saveWallet = function saveWallet(pack) {
	dbfile.update({ type: 'wallet' }, { $set: { pack: pack } }, {}, function (err, numReplaced) {
		if (err) {
			console.log(err);
		}
	});
}

var getWallet = exports.getWallet = function getWallet(cb) {
	dbfile.find({ type: 'wallet' }, function (err, docs) {
		if(docs && docs.length){
			pack = docs[0].pack;
			cb(true, pack);
		} else {
			cb(false);
		}
	});
};