module.exports = function(mongoose, async, logins) {

	var bcrypt = require('bcrypt');
	// var logins = require('../models/logins')(mongoose);


	// defining schemas
	var UserSchema = new mongoose.Schema({
		_id: {type: String, required: true, unique: true},

		// Profile
		username: {type: String, required: true, unique: true},
		usernameLowerCase: {type: String, required: true, unique: true},
		password: {type: String, required: true},

		// Request Trackers
		logins: [],
		logouts: [],
		getMe: [],

		// Activities
		activities: [],

		// Social
		followers: [],
		following: [],

		// Instroments
		projects : {
			id: String,
			name: String
		}

	});

	// schema settings
	UserSchema.set('autoIndex', false);
	UserSchema.index({
		name: 1,
		username: 1
	});

	// models
	var User = mongoose.model('User', UserSchema);


	var createUser = function(options, callbackFn){

		if (!options || !options.username || !options.password) 
			if (callbackFn) return callbackFn({error: 400});
			else return;

		options.usernameLowerCase = options.username.toLowerCase();
		// Base-64 encoding of ObjectId
		options._id = _objectId();
		var r = options.requestor;
		delete options.requestor;


		async.waterfall([
			function(callback){
				// check if the user exists
				userExists(options.usernameLowerCase, function(yes) {
					callback(null, yes);
				});
			},	
			function(userExist, callback) {

				// the user already exists, call the callback function with error code 400 
				if (userExist) callback({error: 400});
				// user does not exist, proceed to next function
				else callback(null);
			}, 
			function(callback) {

				// get salt from bcrypt
				bcrypt.genSalt(10, function(err, salt) {
					callback(err, salt);
				});
			}, 
			function(salt, callback) {
				// get password hash from salt
				bcrypt.hash(options.password, salt, function(err, hash) {
					options.password = hash;
					callback(err);
				});
			},
			function(callback) {
				// create a new user
				var user = new User(options);

				user.save(function(err){
					if (err) {
						console.log('models.User.create callbackFn error:'.error);
						callback(err)
						// return callbackFn({error: err});
					} else {
						console.log('models.User.create: a user succesfully registered.'.info);
						user.logins.push(r);
						user.save();
						callback(null, {success: true, id: user._id});
					}
				});
			}

		], function(error, result) {
			// last function
			if (callbackFn) callbackFn(error, result); 
		});
	};

	var authenticateUser = function(username, password, requestor, callbackFn){

		if (!username || !password) 
			
			if (callbackFn && typeof callbackFn == 'function') 
				return callbackFn({
					error: {
						code: 400,
						err: 'Username and Password are required!'
					}
				});

			else return;

		async.waterfall([
			function(callback) {
				// check if the user exists.
				User.findOne({
					usernameLowerCase: username.toLowerCase() 
				}, function(error, user) {
					callback(error, user);
				});
			},
			function(user, callback) {
				// username doesn't exist or bad password..		
				if (!user) {
					callback({error: {code: 401, err: 'Invalid username/password'}});
				} 
				else
					// compare the user's password to the supplied password
					bcrypt.compare(password, user.password, function(error, result) {
    					callback(error, result, user);
					});
			}, 

			// Scenario 2. 2.a
			function(matched, user, callback) {

				// Scenario 2. 2.a.i
				// User can't be authenticated
				if (!matched) {

					logins.badLogin(user._id, requestor);
					callback({error: {code: 401, err: 'Invalid username/password'}});
				} else {

					logins.successfulLogin(user._id, requestor);
					callback(null, {success: true, id: user.id, username: user.username});
				}
			}
		],
		function(error, result) {
			if (callbackFn) callbackFn(error, result)
		});
	};

	var userExists = function(username, callback) {

		if (!username || !callback) return;
		
		User.findOne({usernameLowerCase: username.toLowerCase()}, function(err, doc){
			if (doc) return callback(true);
			return callback(false);
		});
	};

	var logout = function(id, requestor, callback) {

		User.findOne({_id: id}, function(err, doc){

			if (err) return console.log('User.logout.ERROR: ' + err);

			if (doc) {
				doc.logouts.push(requestor);
				doc.save();
				callback(doc.username);
			}
		});
	};

	var me = function(id, requestor, callback) {

		if (!callback) return;

		User.findOne({_id: id}, function(err, doc){
			
			if (err) return callback({error: 500});
			
			if (!doc) return callback({error: 404});

			var res = {
				username: doc.username,
				activities: doc.activities
			};

			if (doc.logins.length > 0) res.lastLogIn = doc.logins[doc.logins.length - 1]['date'];

			// Callback the user info
			callback(res);

			doc.getMe.push(requestor);
			doc.save();

		});
	};

	var follow = function(me, userIwantToFollow, callbackFn) {
		
		// i want to follow another user

		if (!me || !userIwantToFollow) return callbackFn(404);

		async.waterfall(
		[
			function(callback) {
				User.findOne({
					usernameLowerCase: me.toLowerCase() 
				}, function(error, _me){
					callback(error, _me);
				});
			},
			function(_me, callback) {
				User.findOne({
					usernameLowerCase: userIwantToFollow.toLowerCase() 
				}, function(error, _userIwantToFollow) {
					callback(error, _userIwantToFollow, _me);
				});
			}, 
			function(_userIwantToFollow, _me, callback) {
				_me.following.push(userIwantToFollow);
				_userIwantToFollow.followers.push(me);
				_me.save();
				_userIwantToFollow.save();
				callback(null, 200);
			}
		],
		function(error, result) {
			if (callbackFn) callbackFn(error, result);
		});
	};

	var unFollow = function(me, userIwantToUnfollow, callback) {

		// i want to stop following another user (userIwantToUnfollow)

		if (!me || !userIwantToUnfollow) return callbackFn(404);

		async.waterfall(
		[
			function(callback) {
				User.findOne({
					usernameLowerCase: me.toLowerCase() 
				}, function(error, _me){
					callback(error, _me);
				});
			},
			function(_me, callback) {
				User.findOne({
					usernameLowerCase: userIwantToUnfollow.toLowerCase() 
				}, function(error, _userIwantToUnfollow) {
					callback(error, _userIwantToUnfollow, _me);
				});
			}, 
			function(_userIwantToUnfollow, _me, callback) {
				_me.following.splice(_me.following.indexOf(userIwantToUnfollow), 1);
				_userIwantToUnfollow.followers.splice(_userIwantToUnfollow.followers.indexOf(me), 1);
				_me.save();
				_userIwantToUnfollow.save();
				callback(null, 200);
			}
		],
		function(error, result) {
			if (callbackFn) callbackFn(error, result);
		});
	};

	var getUser = function(name, callback) {
		User.findOne({usernameLowerCase: name.toLowerCase()}, ['username', 'followers', 'following']
		, function(error, user) {
			callback(user);
		});
	};

	var _objectId = function() {
		return new Buffer((new mongoose.Types.ObjectId).toString()).toString('base64');
	};

	var insertActivity = function(username, actv, broadcaster) {

		User.findById(username, function(error, u){
			if (error) callback(error);

			if (!u) return console.log('invalid activity: couldn`t find the user with'+
				'session.uid!');

			if (broadcaster != u.username) 
				return console.log('A user is broadcasting a message,'+
					' while it`s name and id doesn`t match!'.error);

			_saveActivity(u, function(){
				var followers_id = [];

				// save the activity to all followers of the broadcaster
				for (var i in u.followers)
					followers_id.push(u.followers[i]._id);

				// find the followers of the user
				User.find({"_id": {$in: followers_id}}, function(error, flwz){
					for (var i in flwz)

						// save the activity to all followers
						_saveActivity(flwz[i]);
				});
			});

			function _saveActivity(user, callback) {
				user.activities.push({
					id: actv._id,
					text: actv.text,
					vars: actv.vars,
					timestamp: actv.timestamp
				});

				// keep the last 15 activities.
				user.activities.splice(0, user.activities.length - 15);

				user.markModified('activities');
				user.save(function(error) {
					if (error) {
						console.log('error saving activity in User!'.error);
						console.log(error);
						return;
					}
					if (callback) callback();

				});
			};
			
		});
	};

	return {
		User: User,
		createUser: createUser,
		authenticateUser: authenticateUser,
		logout: logout,
		me: me,
		follow: follow,
		unFollow: unFollow,
		getUser: getUser,
		insertActivity: insertActivity
	};
};