/* CMPS 128 Key Value Store Assignment 2 */

var request = require('request-promise');

class VectorClock {
	constructor () {
		this.clock = {};
	}

	// Returns true if a is casaully dominated by b
	static greaterThan(a, b) {
		var result = false;
		for(var ip in a) {
			if(b[ip] < a[ip])
				return false;
			else if(b[ip] > a[ip])
				result = true;
		}
		return result;
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
}

class Node {
	constructor(view) {
		this.kvs = {};
		this.vc = new VectorClock(view);
		view.split(",").forEach((ip) =>
			this.addNode(ip)
		);
		this.gossipInterval = setInterval(() => this.gossip(), 500);
	}

	/* KVS methods ------------------------------------------ */

	hasKey (key) {
		return key in this.kvs;
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
		return this.kvs[key].value;
	}

	// Returns true if key-value pair was removed
	removeKey (key) {
		if(!this.hasKey(key))
			return false;
		return delete this.kvs[key];
	}

	// Returns the payload
	getPayload (key) {
		return this.kvs[key].vc;
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
		console.log("Initiating gossip with " + ip);
		request.post({
			url: 'http://' +ip+'/gossip',
			json: true,
			body: {
				vc: this.vc.clock,
				kvs: this.kvs
			}
		}, (err, res, body) => {
				if(!err)
					this.reconcile(body.vc, body.kvs)
			}
		);
	}

	findRandomNode () {
		/* Collect IPs of other nodes */
		var ipTable = this.view().filter(function (value) {
			return value != process.env.IP_PORT;
		});

		return ipTable[Math.floor(Math.random() * ipTable.length)];
	}

	reconcile (clock, kvs) {
		// compare vector clocks first
		if(VectorClock.greaterThan(this.vc.clock, clock)) {
			this.kvs = kvs;
		}

		// if incomparable then do on a key by key basis
		for (var key in this.kvs ) {

			// if the key isn't in the other kvs 
			// add to the other kvs 
			if (!(key in kvs)) {
				kvs[key] = this.kvs[key];
			}
			else { // compare and take the later value
				if (kvs[key].vc.greaterThan(this.kvs[key].vc) ) 
				{
					// this kvs is greater than kvs of other node
					this.kvs[key] = kvs[key];
				}
				else if (this.kvs[key].vc.greaterThan(kvs[key].vc) )
				{
					// this kvs is less than kvs of other node
					kvs[key] = this.kvs[key];
				}
				else // vc are incomparable 
				{
					var thisTime = new Date (this.kvs[key].timestamp);
					var otherTime = new Date (kvs[key].timestamp);

					// compare timestamps 
					if (thisTime > otherTime ) {
						kvs[key]= this.kvs[key];
					}
					else 
					{
						this.kvs[key] = kvs[key];
					}
				}
			}
		}

	}
}

// Initializes the vector clock with the view
node = new Node(process.env.VIEW);

module.exports = function (app) {

	app.post('/gossip', (req, res) => {
		console.log("Recieved:");
		console.log(req.body);
		node.reconcile(req.body.vc, req.body.kvs);
		res.json({
			vc: node.vc.clock,
			kvs: node.store
		});
	});

	/* GET getValue given key method --> returns value for given key */
	app.get('/keyValue-store/:key', (req, res) => {
		if(node.hasKey(req.params.key)){
			res.status(200).json({
				'result': 'Success',
				'value': node.getValue(req.params.key),
				'payload': node.getPayload(req.params.key)
			});
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
		res.status(200).json({
			'isExists': node.hasKey(req.params.key),
			'result': 'Success',
			'payload': node.getPayload(req.params.key)
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
			if(node.hasKey(req.params.key)) {
				res.status(200);
				responseBody.msg = "Updated successfully";
				if(node.setValue(req.params.key, req.body.val))
					responseBody.replaced = "True";
				else
					responseBody.replaced = "False";
			} else {
				node.setValue(req.params.key, req.body.val);
				res.status(201);
				responseBody.replaced = "False";
				responseBody.msg = "Added successfully";
			}
			responseBody.payload = node.getPayload(req.params.key);
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
				'payload': node.getPayload(req.params.key)
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
}
