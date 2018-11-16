/* CMPS 128 Key Value Store Assignment 2 */

// KVS data structure
keyValueStore = {
	store: {},
	// returns: true if value is successfully updated (changed) else false
	set: function (key, value) {
		if(this.hasKey(key) && value == this.store[key]) // Doesn't work for object equality - not sure if problematic
			return false;
		this.store[key] = value;
		return true;
	},
	hasKey: function(key) { // returns boolean
		return key in this.store;
	},
	get: function (key) {
		return this.store[key]; // returns value
	},
	// returns: true if the key-value pair was deleted, else false
	// if the given key does not exist, returns false
	remove: function (key) {
		if(!this.hasKey(key))
			return false;
		return delete this.store[key]
	}
};

// Wrapper object for the host's vector clock
// HAVEN'T TESTED VERY THOROUGHLY
vectorClock = {
	vc: {},

	// Adds a node to the view
	// Returns false if node already exists
	addNode: function (ip) {
		if(ip in this.vc)
			return false;
		this.vc[ip] = 0;
		return true;
	},

	// Returns the string representation of the view
	view: function () {
		return Object.keys(vectorClock.vc).join(",");
	},

	// Increments the clock for this host
	incrementClock: function () {
		this.vc[process.env.IP_PORT]++;
	},

	// Returns true if this vector clock is greater than the given clock
	greaterThan: function (clock) {
		for(var ip in this.vc) {
			if(this.vc[ip] < clock[ip])
				return false;
		}
		return true;
	},

	// Sets the vector clock to the pairwise-max with the given clock
	pairwiseMax: function (clock) {
		for(var ip in this.vc) {
			this.vc[ip] = Math.max(this.vc[ip], clock[ip]);
		}
	}
};

// Initializes the vector clock with the view
process.env.VIEW.split(",").forEach(function (ip) {
	vectorClock.addNode(ip)
});

module.exports = function (app) {

	/* GET getValue given key method --> returns value for given key */
	app.get('/keyValue-store/:key', (req, res) => {
		console.log('LEADER GET KEYVALUESTORE');
		if(keyValueStore.hasKey(req.params.key)){
			res.status(200).json({
				'result': 'Success',
				'value': keyValueStore.get(req.params.key),
				'payload': '<payload>' /* req.body(payload) */
			});
		}else{
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
			'isExists': keyValueStore.hasKey(req.params.key),
			'result': 'Success',
			'payload': '<payload>' /* req.body(payload) */
		});
	});

	/* GET method for view */
	/* return a comma separated list of all ip-ports run by containers */
	app.get('/view', (req, res) => {
		res.status(200).json({
			'view': '<IP-PORT>'
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
			if(keyValueStore.hasKey(req.params.key)) {
				res.status(200);
				responseBody.msg = "Updated successfully";
				if(keyValueStore.set(req.params.key, req.body.val))
					responseBody.replaced = "True";
				else
					responseBody.replaced = "False";
			} else {
				keyValueStore.set(req.params.key, req.body.val);
				res.status(201);
				responseBody.replaced = "False";
				responseBody.msg = "Added successfully";
			}
			responseBody.payload = req.body(payload);
			res.json(responseBody);
		}
	});

	/* PUT method for view */
	/* Tell container to initiate a view change such that all containers */
	/* add the new containers ip port <NewIPPort> to their views */
	/* If container is already in view, return error message */
	app.put('/view', (req, res) => {
		/* if() {
			res.status(200).json({
				'result': 'Success',
				'msg': 'Successfully added ' + req.body(ip_port) + ' to view'
			});
		} else {
			res.status(404).json({
				'result': 'Error',
				'msg': req.body(ip_port) + ' is already in view'
			});
		} */
	});

	/* Deletes given key-value pair from KVS */
	app.delete('/keyValue-store/:key', (req, res) => {
		if(keyValueStore.remove(req.params.key)) {
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

	/* DELETE method for view */
	/* Tell container to initiate a view change such that all containers */
	/* add the new containers ip port <RemovedIPPort> to their views */
	/* If container is already in view, return error message */
	app.delete('/view', (req, res) => {
		/* if() {
			res.status(200).json({
				'result': 'Success',
				'msg': 'Successfully removed ' + req.body(ip_port) + ' from view'
			});
		} else {
			res.status(404).json({
				'result': 'Error',
				'msg': req.body(ip_port) + ' is not in current view'
			});
		} */
	});

	app.get('/view', (req, res) => {
		res.status(200).json({
			'view': vectorClock.view()
		})
	});

	// Increments the host's clock and returns the current vector clock
  app.get('/test', (req, res) => {
		vectorClock.incrementClock();
		res.send(JSON.stringify(vectorClock.vc));
  });

}
