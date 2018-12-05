/* CMPS 128 Key Value Store Assignment 4 */

var request = require('request-promise');
var djb2 = require('djb2');

class VectorClock {
	constructor () {
		this.clock = {};
	}

	// Returns true if a is causally dominated by b
	static greaterThanOrEqualTo(a, b) {
		for(var ip in a) {
			if(b[ip] < a[ip])
				return false;
		}
		return true;
	}

	// Returns true if a and b are incomparable
	static incomparable(a, b) {
		var aGreater = false, bGreater = false;
		for(var ip in a) {
			if(b[ip] < a[ip])
				aGreater = true;
			else if(b[ip] > a[ip])
				bGreater = true;
		}
		return aGreater && bGreater;
	}

	// Increments the clock for this host
	incrementClock () {
		this.clock[process.env.IP_PORT]++;
	}

	// Sets the vector clock to the pairwise-max with the given clock
	pairwiseMax (clock) {
		for(var ip in this.clock) {
			this.clock[ip] = Math.max(this.clock[ip], clock[ip]);
		}
	}

	copyClock (clock) {
		for(var ip in this.clock) {
			this.clock[ip] = clock[ip];
		}
	}
}

class Node {
	constructor(view, shardCount) {
		this.shardID;
		this.shardList;
		this.kvs = {};
		this.vc = new VectorClock(view);
		view.split(",").forEach((ip) =>
			this.addNode(ip)
		);
		this.createShardList(shardCount);
		this.gossipInterval = setInterval(() => this.gossip(), 500);
	}

	/* KVS methods ------------------------------------------ */

	hasKey (key) {
		return (key in this.kvs) && (this.kvs[key].value != undefined);
	}

  // returns list of all shard IDs in system
	getAllShardIds() {
		var shards = [];
		this.shardList.forEach(function(){
			shards.push(shards.length);
		});
		return shards;
	}

  // initialize a node's shardList and partition
	createShardList (shardCount) {

		clearInterval(this.gossipInterval); 
		this.shardList = []; 
		for (var len = 0; len < shardCount; len++)
		{
			this.shardList.push([]);
		}

		//distribute data across shards --> RR / Random /
		var count =0;
		for (var server in this.vc.clock)
		{
			console.log(this.shardList);
			var index = count % shardCount;
			//push the node into the array for the shard group
			this.shardList[index].push(server); 
			count++;
			if (server == process.env.IP_PORT)
			{
				this.shardID = index; 
			}
		}
		console.log('THIS IS THE SHARD LIST\n');
		console.log(this.shardList);
		this.gossipInterval = setInterval(() => this.gossip(), 500);
	}

	// Returns true if the key is new
	setValue (key, value) {
		var result = this.hasKey(key);
		this.vc.incrementClock();
		this.kvs[key] = {
			value: value,
			vc: Object.assign({}, this.vc.clock),
			timestamp: Date.now()
		}
		return result;
	}

	// Get key for given value
	getValue (key) {
		this.kvs[key].vc = Object.assign({}, this.vc.clock);
		return this.kvs[key].value;
	}

	// Returns true if key-value pair was removed
	removeKey (key) {
		this.vc.incrementClock();
		if(!this.hasKey(key))
			return false;
		// update key clock and delete value
		this.kvs[key].vc = Object.assign({}, this.vc.clock);
		return delete this.kvs[key].value;
	}

	// Returns the payload
	getPayload (key) {
		if(key in this.kvs)
			return this.kvs[key].vc;
		return this.vc.clock;
	}

	/* Node communication methods --------------------------- */

	// Returns the view of this node
	view () {
		return Object.keys(this.vc.clock);
	}

	// Add node to the view
	addNode (ip) {
		if(ip in this.vc.clock)
			return false;
		this.vc.clock[ip] = 0;
		return true;
	}

	// Removes a node from the view
	// Returns false if node doesn't already exist
	removeNode (ip) {
		if(!ip in this.vc.clock)
			return false;
		delete this.vc.clock[ip];
		return true;
	}

	// Gossips with a random node
	gossip () {
		var ip = this.findRandomNode();
		request.post({
			url: 'http://' +ip+'/gossip',
			json: true,
			body: {
				vc: this.vc.clock,
				kvs: this.kvs
			}
		}, (err, res, body) => {
				if(!err) {
					this.kvs = body.kvs;
					this.vc.copyClock(body.vc);
					// this.vc.clock = body.vc;
				}
			}
		);
	}

	findRandomNode () {
		/* Collect IPs of other nodes */
		var ipTable = this.shardList[this.shardID].filter(function (value) {
			return value != process.env.IP_PORT;
		});

		return ipTable[Math.floor(Math.random() * ipTable.length)];
	}

	reconcile (clock, kvs) {
		// compare vector clocks first
		if(VectorClock.greaterThanOrEqualTo(this.vc.clock, clock) && !VectorClock.incomparable(this.vc.clock, clock)) {
			this.kvs = kvs;
		} else {
			// If incomparable then do on a key by key basis
			for (var key in kvs) {
				// If the kvs recieved has keys this node does not, just copy
				if (!(key in this.kvs)) {
					this.kvs[key] = kvs[key];
				}
				else {
					// Check by vector clock
					if(VectorClock.greaterThanOrEqualTo(this.kvs[key].vc, kvs[key].vc)) {
						this.kvs[key] = kvs[key];
					} else if(VectorClock.incomparable(this.kvs[key].vc, kvs[key].vc)) { // Fallback to timestamp if incomparable
						var thisTime = new Date (this.kvs[key].timestamp);
						var otherTime = new Date (kvs[key].timestamp);

						// compare timestamps
						if (otherTime > thisTime)
							this.kvs[key] = kvs[key];
					}
				}
			}
		}

		this.vc.pairwiseMax(clock);
	}

	// count the number of keys in the node 
	countKeys () {
		keyCount = 0; 
		// iterate through the kvs 
		for (var key in this.kvs ) {
			// if the key exists
			if (kvs[key] != undefined)
			{
				keyCount++; 
			}
		}
		return keyCount; 
	}

	// get the node associated with the shard
	getShardNode(shard_id) {
		// should always be something in the shard group
		if (this.shardList[shard_id].length != 0){
			return this.shardList[shard_id][0];
		}
	}
}

// Initializes the vector clock with the view and shard count
node = new Node(process.env.VIEW, parseInt(process.env.S));

module.exports = function (app) {

	app.post('/gossip', (req, res) => {
		// console.log("Recieved gossip:");
		// console.log(req.body);
		node.reconcile(req.body.vc, req.body.kvs);
		res.json({
			vc: node.vc.clock,
			kvs: node.kvs
		});
	});

	/* GET getValue given key method --> returns value for given key */
	app.get('/keyValue-store/:key', (req, res) => {
		console.log('in the get method');
		node.vc.incrementClock();
		// if the key is in this shard 


		if(node.hasKey(req.params.key)){
			var keyClock = node.getPayload(req.params.key);
			if (VectorClock.greaterThanOrEqualTo(req.body.payload, keyClock)) {
				node.kvs[req.params.key].vc = Object.assign({}, node.vc.clock);
				res.status(200).json({
					'result': 'Success',
					'value': node.getValue(req.params.key),
					'payload': node.vc.clock
				});
			} else {
				res.status(400).json({
					'result': 'Error',
					'msg': 'Payload up to date',
					'payload': node.getPayload(req.params.key)
				});
			}
	  } else {
	    res.status(404).json({
	      'result': 'Error',
	      'msg': 'Key does not exist',
	      'payload': node.getPayload(req.params.key)
	    });
	  }
	});

	/* GET hasKey given key method --> returns true if KVS contains the given key */
	app.get('/keyValue-store/search/:key', (req, res) => {
		node.vc.incrementClock();
		console.log("THIS IS THE HASH OF THE KEY!!!! \n\n\n");
		console.log( djb2(req.params.key) % node.shardList.length);
		var keyShardNum = djb2(req.params.key) % node.shardList.length;
		
		// if the shard is not on this node
		if (keyShardNum != node.shardID){

		}
		else {
			var keyClock = node.getPayload(req.params.key);
			if (VectorClock.greaterThanOrEqualTo(req.body.payload, keyClock)) {
				if(node.hasKey(req.params.key))
					node.kvs[req.params.key].vc = Object.assign({}, node.vc.clock);
				res.status(200).json({
					'isExists': node.hasKey(req.params.key),
					'result': 'Success',
					'payload': node.vc.clock
				});
			} else {
				res.status(400).json({
					'result': 'Error',
					'msg': 'Payload out of date',
					'payload': node.vc.clock
				});
			}
		}
	});

	/* Sets value for given key for KVS */
	app.put('/keyValue-store/:key', (req, res) => {
		if(req.params.key.length < 1 || req.params.key.length > 200)
			res.json({
				'result': 'Error',
				'msg': 'Key not valid'
			});
		else {
			var responseBody = {};
			if(node.hasKey(req.params.key)) {
				res.status(201);
				responseBody.msg = "Updated successfully";
				if(node.setValue(req.params.key, req.body.val))
					responseBody.replaced = true;
				else
					responseBody.replaced = false;
			} else {
				node.setValue(req.params.key, req.body.val);
				res.status(200);
				responseBody.replaced = false;
				responseBody.msg = "Added successfully";
			}
			responseBody.payload = req.body.payload;
			res.json(responseBody);
		}
	});

	/* Deletes given key-value pair from KVS */
	app.delete('/keyValue-store/:key', (req, res) => {
		if(node.removeKey(req.params.key)) {
			res.status(200).json({
				'result': 'Success',
				'msg': 'Key deleted',
				'payload': node.getPayload(req.params.key)
			});
		} else {
			res.status(404).json({
				'result': 'Error',
				'msg': 'Key does not exist',
				'payload': node.vc.clock
			});
		}
	});


	/*
	 View routes -------------------------------------------------------
	*/

	/* GET method for view */
	/* return a comma separated list of all ip-ports run by containers */
	app.get('/view', (req, res) => {
		res.status(200).json({
			'view': node.view().join(",")
		});
	});

	/* PUT method for view */
	/* Tell container to initiate a view change such that all containers */
	/* add the new containers ip port <NewIPPort> to their views */
	/* If container is already in view, return error message */
	app.put('/view', (req, res) => {
		Promise.all(node.view().map(function (ip) {
			if(!('forward' in req.body) && ip != process.env.IP_PORT) {
				request({
					method: 'PUT',
					uri: 'http://' + ip + '/view',
					body: {
						forward: false,
						ip_port: req.body.ip_port
					},
					json: true
				});
			}
		})).then( function (values) {
			// It's not ideal but assumes that adding was successful for the other nodes as well
			if(node.addNode(req.body.ip_port)) {
				res.status(200).json({
					'result': 'Success',
					'msg': 'Successfully added ' + req.body.ip_port + ' to view'
				});
			} else {
				res.status(404).json({
					'result': 'Error',
					'msg': req.body.ip_port + ' is already in view'
				});
			}
		});
	});

	/* DELETE method for view */
	/* Tell container to initiate a view change such that all containers */
	/* add the new containers ip port <RemovedIPPort> to their views */
	/* If container is already in view, return error message */
	app.delete('/view', (req, res) => {
		if(req.body.ip_port == process.env.IP_PORT)
			node.vc.clock = {};
		Promise.all(node.view().map(function (ip) {
			if(!('forward' in req.body) && ip != process.env.IP_PORT) {
				request({
					method: 'DELETE',
					uri: 'http://' + ip + '/view',
					body: {
						forward: false,
						ip_port: req.body.ip_port
					},
					json: true
				});
			}
		})).then( function (values) {
			// It's not ideal but assumes that deleting was successful for the other nodes as well
			if(node.removeNode(req.body.ip_port)) {
				res.status(200).json({
					'result': 'Success',
					'msg': 'Successfully removed ' + req.body.ip_port + ' from view'
				});
			} else {
				res.status(404).json({
					'result': 'Error',
					'msg': req.body.ip_port + ' is not in current view'
				});
			}
		});
	});

	/*
	 Shard routes -------------------------------------------------------
	*/

	// Return container's shard id (will be set in distribution alg)
	app.get('/shard/my_id', (req, res) => {
		res.status(200).json({
			'id': node.shardID
		});
	});

	// Return a list of all shard ids in system
	app.get('/shard/all_ids', (req, res) => {
		res.status(200).json({
			'result': 'Success',
			'shard_ids': node.getAllShardIds()
		});
	});

	// Return a list of all members in the shard with id <shard_id>
	// Each member should be represented as an ip-port address
	app.get('/shard/members/:shard_id', (req, res) => {
		if (parseInt(req.params.shard_id) < node.shardList.length) {
			res.status(200).json({
				'result': 'Success',
				'members': node.view().join(",")
			});
		}else{
			res.status(404).json({
				'result': 'Error',
				'msg': 'No shard with id ' + req.params.shard_id
			});
		};
	});


	// Return the number of key-value pairs that shard is responsible for (integer)
	app.get('shard/count/:shard_id', (req, res) => {
		var shard_id = req.params.shard_id; 
		// only if the shard is in the node
		if (shard_id != node.shardID){
			var ip = node.getShardNode(shard_id);
			request({
				method: 'GET',
				uri: 'http://' + ip + '/shard/count/' + shard_id
			}, (err, res2, body) => {
				res.send(res2);
			});
		}
		else {
			// must be shard 0 or greater 
			if (parseInt(shard_id) >= 0 && parseInt(shard_id) < node.shardList.length) {
				res.status(200).json({
					'result': 'Success',
					'Count': node.countKeys()
				});
			}else{
				res.status(404).json({
					'result': 'Error',
					'msg': 'No shard with id ' + shard_id
				});
			};
		}
	});


	// Initiates a change in replica groups such that key-values are redivided
	// across <number> groups and returns list of all shard ids
	app.put('/shard/changeShardNumber', (req, res) => {
		// if <number> is greater than number of nodes
			/* res.status(400).json({
				'result': 'Error',
				'msg': 'Not enough nodes for <number> shards'
			}); */
		// if there i only 1 node in any partition as a result of redividing
			/* res.status(400).json({
				'result': 'Error',
				'msg': 'Not enough nodes. <number> shards result in a
						nonfault tolerant shard'
			}); */
	});

}
