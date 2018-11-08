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

// Feel free to rewrite as needed

// Wrapper object for the view
// TODO: add methods for adding and deleting from the view list
view = {
	// Initialize the view as the list specified in environment variables 
	// v should always match the keys of the vectorClock.vc object
	v: process.env.VIEW.split(",")

};

// Wrapper object for the host's vector clock
// HAVEN'T TESTED VERY THOROUGHLY
vectorClock = {
	vc: {},

	// Creates the vector clock as an object with a property for each ip in view
	create: function (view) {
		view.forEach(function(ip) {
			this.vc[ip] = 0;	
		}, this) 
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
	}
};

// Initializes the vector clock with the view
vectorClock.create(view.v);

module.exports = function (app) {

	/* GET getValue given key method --> returns value for given key */
	app.get('/keyValue-store/:key', (req, res) => {
		console.log('LEADER GET KEYVALUESTORE');
		if(keyValueStore.hasKey(req.params.key)){
			res.status(200).json({
				'result': 'Success',
				'value': keyValueStore.get(req.params.key),
				'payload': '<payload>' /* get payload call */
			});
		}else{
			res.status(404).json({
				'result': 'Error',
				'msg': 'Key does not exist',
				'payload': '<payload>' /* get payload call */
			});
		}
	});

	/* GET hasKey given key method --> returns true if KVS contains the given key */
	app.get('/keyValue-store/search/:key', (req, res) => {
		res.status(200).json({
			'isExists': keyValueStore.hasKey(req.params.key),
			'result': 'Success',
			'payload': '<payload>' /* get payload call */
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
			/* responseBody.payload = get payload call */
			res.json(responseBody);
		}
	});

	/* Deletes given key-value pair from KVS */
	app.delete('/keyValue-store/:key', (req, res) => {
		if(keyValueStore.remove(req.params.key)) {
			res.status(200).json({
				'result': 'Success',
				'msg': 'Key deleted',
				'payload': '<payload>' /* get payload call */
			});
		} else {
			res.status(404).json({
				'result': 'Error',
				'msg': 'Key does not exist',
				'payload': '<payload>' /* get payload call */
			})
		}
	});

	// Increments the host's clock and returns the current vector clock
   	app.get('/test', (req, res) => {
		vectorClock.incrementClock();
		res.send(JSON.stringify(vectorClock.vc));
   	});

}
