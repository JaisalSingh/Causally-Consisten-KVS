/* CMPS 128 Kev Value Store Assignment 2 */


// KVS data structure
// returns: true if value is successfully updated (changed) else false
keyValueStore = {
	store: {},
	set: function (key, value) {
		if(this.hasKey(key) && value == this.store[key])
			return false;
		this.store[key] = value;
		return true;
	},
	hasKey: function(key) { // returns boolean
		return key in this.store;
	},
	get: function (key) {
		return this.store[key]; // returns value
	}
}

module.exports = function (app, db) {


	/* GET hasKey method */
	app.get('/keyValue-store/:key', (req, res) => {
	});










	/* put method */
	app.put('/keyValue-store/:key', (req, res) => {
		// if(err.statuscode == 413)
		// 	res.json({
		// 		'result': 'Error',
		// 		'msg': 'Object too large. Size limit is 1MB'
		// 	});
		// else

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
			responseBody.keyValueStore = keyValueStore.store;
			res.json(responseBody);
		}

		// console.log(req.body);
		// keyValueStore[req.params.key] = req.body.val;
		// res.send('PUT REQUEST RECEIVED');
	});







	///* searchKey method *////
	// app.searchKey('/search', (req, res) => {
	// 	if(keyValueStore.hasKey(req.param.key)){
	// 		res.status(200);
	// 		/*
	// 		res.json({
	// 			'result': 'Success',
	// 			'isExists': 'true'
	// 		});
	// 		*/
	// 		responseBody.result = "Success"
	// 		responseBody.isExists = "true"
	// 	}else{
	// 		res.status(201);
	// 		/*
	// 		res.json({
	// 			'result': 'Error',
	// 			'isExists': 'false'
	// 		});
	// 		*/
	// 		responseBody.result = "Failed"
	// 		responseBody.isExists = "false"
	// 	}
	// 	res.json(responseBody);
	// });









	// ///* retyrnKey method *////
	// app.returnKey('/search', (req, res) => {
	// });







	///* delete method *////
	app.delete('/keyValue-store/:key', (req, res) => {
		if(keyValueStore.hasKey(req.param.key)){
			res.status(200);
			keyValueStore.remove(req.params.key, req.body.val);
			/*
			res.json({
				'result': 'Success'
			});
			*/
			responseBody.result = "Success"
		}else{
			res.status(404);
			/* res.json({
				'result': 'Error',
				'msg': 'Status code 404'
			}); */
			responseBody.result = "Failed"
			responseBody.msg = "Status code 404"
	}
	res.json(responseBody);
  });









   /* post test method assignment 1 */
   app.post('/test', (req, res) => {
   	res.send('POST message received: ' + req.query.msg);
   });
	 /* post hello mehthod assignment 1 */
   app.post("/hello", function(req, res) {
   	res.status(405).end();
   });
   /* get methods test assignment 1 */
   app.get('/test', (req, res) => {
   	res.send('GET request received');
   });
	 /* get methods hello assignment 1 */
   app.get("/hello", (req, res, next) => { // Why is there next here
   	res.send("Hello world!");
   });

}
