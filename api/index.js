var mainRoutes = require ('./routes.js');
var followerRoutes = require ('./follower-routes.js');

module.exports = function (app) {
	if (process.env.MAINIP == null ){
		mainRoutes(app);
	}
	else {
		followerRoutes(app); 
	}
}
