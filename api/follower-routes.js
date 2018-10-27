// functions for the follower server which sends requests to the main server

// NEED TO DO:
// handle when leader goes down


module.exports = function(app)
{
	var http = require('http');
	console.log('IN THE FOLLOWER INSTANCE!!!\n\n\n');

	app.get('/keyValue-store/:key', (req, res) => {
		http.get('http://' + process.env.MAINIP +  req.path, (res) => { // make call to leader to get value
			res.on('error', (err) => { // if leader is down send error code 501
				res.json({
					'result' : 'Error',
					'value' : 'Server unavailable'
				});
				res.statusCode = 501;
			})
		});
		console.log(req);
	});

	app.get('/keyValue-store/search/:key', (req, res) => {
		http.get('http://' + process.env.MAINIP + req.path, (res) => {
			res.on('error', (err) => {
				res.json({
					'result' : 'Error',
					'value' : 'Server unavailable'
				});
				res.statusCode = 501;
			})
		});
	});


	app.put('/keyValue-store/:key', (req, res) => {
		http.put('http://' + process.env.MAINIP + req.path, (res) =>{  // make put call to leader
			res.on('error', (err) => { // if the leader is down send error code 501
				res.json({
					'result' : 'Error',
					'value' : 'Server unavailable'
				});
				res.statusCode = 501;
			});
		});
	});


	app.delete('/keyValue-store/:key', (req, res) => {
		http.delete('http://' + process.env.MAINIP + req.path, (res) => {
			res.on('error', (err) => {
				res.json({
					'result' : 'Error',
					'value' : 'Server unavailable'
				});
				res.statusCode = 501;
			});
		});
	});

}
