var express = require('express'),
  	app = express(),
	port = process.env.PORT || 8080,
	bodyParser = require('body-parser');

// Original code
app.use(bodyParser.urlencoded({ extended: true }));//, limit:"1MB" }));
app.use(bodyParser.json());

// app.use(bodyParser.json({ limit: '1mb' }));
// app.use(bodyParser.urlenencoded({ limit: '1mb', extended: true}));

require('./api/') (app, {});

app.listen(port);


console.log('Server started on: ' + port);
