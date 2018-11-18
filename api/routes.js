/* CMPS 128 Key Value Store Assignment 2 */

var request = require('request-promise');

// KVS data structure
// {
//     key: {
// 	       value: "the actual value for the key",
// 		   timestamp: "the time at write",
// 		   vectorclock: "the node's vector clock at write time"
// 	   }
// }
class KeyValueStore {
	constructor() {
		this.store = {};
	}

	hasKey (key) {
		return key in this.store;
	}

	// Returns true if the key is new
	setValue (key, value, clock) {
		var result = this.hasKey(key);
		this.store[key] = {
			value: value,
			vc: Object.assign({}, clock),
			timestamp: Date.now()
		}
		return result;
	}

	// Get key for given value
	getValue (key) {
		return this.store[key].value;
	}

	// Returns true if key-value pair was removed
	removeKey (key) {
		if(!this.hasKey(key))
			return false;
		return delete this.store[key];
	}
}

class VectorClock {
	constructor () {
		this.clock = {};
	}

	// Increments the clock for this host
	incrementClock () {
		this.clock[process.env.IP_PORT]++;
	}

	// Returns true if this vector clock is greater than the given clock
	greaterThan (clock) {
		for(var ip in this.clock) {
			if(this.clock[ip] < clock[ip])
				return false;
		}
		return true;
	}

	// Sets the vector clock to the pairwise-max with the given clock
	pairwiseMax (clock) {
		for(var ip in this.clock) {
			this.clock[ip] = Math.max(this.clock[ip], clock[ip]);
		}
	}
}

class Node {
	constructor(view) {
		this.kvs = new KeyValueStore();
		this.vc = new VectorClock(view);
		view.split(",").forEach((ip) =>
			this.addNode(ip)
		);
	}

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
		console.log("Initiating gossip with " + ip);
		request.post({
			url: 'http://' +ip+'/gossip',
			json: true,
			body: {
				vc: this.vc.clock,
				kvs: this.kvs.store
			}
		}, function(err, res, body) {
			// The recieving node will respond with its own KVS
			// Reconcile with this node's KVS
		});
	}

	findRandomNode () {
		/* Collect IPs of other nodes */
		var ipTable = this.view().filter(function (value) {
			return value != process.env.IP_PORT;
		});

		return ipTable[Math.floor(Math.random() * ipTable.length)];
	}
}

// Initializes the vector clock with the view
node = new Node(process.env.VIEW);

module.exports = function (app) {

	app.post('/gossip', (req, res) => {
		console.log("Recieved a gossip:");
		console.log(req.body);
		res.json();
	});

	/* GET getValue given key method --> returns value for given key */
	app.get('/keyValue-store/:key', (req, res) => {
		if(node.kvs.hasKey(req.params.key)){
			res.status(200).json({
				'result': 'Success',
				'value': node.kvs.getValue(req.params.key),
				'payload': '<payload>' /* req.body(payload) */
			});
		} else {
			res.status(404).json({
				'result': 'Error',
				'msg': 'Key does not exist',
				'payload': '<payload>' /* req.body(payload) */
			});
		}
	});

	/* GET hasKey given key method --> returns true if KVS contains the given key */
	app.get('/keyValue-store/search/:key', (req, res) => {
		res.status(200).json({
			'isExists': node.kvs.hasKey(req.params.key),
			'result': 'Success',
			'payload': '<payload>' /* req.body(payload) */
		});
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
			if(node.kvs.hasKey(req.params.key)) {
				res.status(200);
				responseBody.msg = "Updated successfully";
				if(node.kvs.setValue(req.params.key, req.body.val, node.vc.clock))
					responseBody.replaced = "True";
				else
					responseBody.replaced = "False";
			} else {
				node.kvs.setValue(req.params.key, req.body.val, node.vc.clock);
				res.status(201);
				responseBody.replaced = "False";
				responseBody.msg = "Added successfully";
			}
			res.json(responseBody);
		}
	});

	/* Deletes given key-value pair from KVS */
	app.delete('/keyValue-store/:key', (req, res) => {
		if(node.kvs.removeKey(req.params.key)) {
			res.status(200).json({
				'result': 'Success',
				'msg': 'Key deleted',
				'payload': '<payload>' /* req.body(payload) */
			});
		} else {
			res.status(404).json({
				'result': 'Error',
				'msg': 'Key does not exist',
				'payload': '<payload>' /* req.body(payload) */
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

	// Test method to increment vector clock
	app.put('/vectorClock/add', (req, res) => {
		node.vc.incrementClock();
		res.json(node.vc.clock);
	})

	setInterval(function() {node.gossip()}, 1000);

	
}
