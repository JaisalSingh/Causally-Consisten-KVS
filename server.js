var express = require('express'),
  	app = express(),
	port = process.env.PORT || 8080,
	bodyParser = require('body-parser'); 

app.use(bodyParser.urlencoded({ extended: true }));//, limit:"1MB" }));
app.use(bodyParser.json());

require('./api/') (app, {});

app.listen(port);


console.log('Server started on: ' + port);
