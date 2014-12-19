// ===================================================================
// CONFIGURATION
// ===================================================================
var express 					= require('express'),
		ejs 							= require('ejs'),
		app								= express(),
		path							= require('path'),
		bodyParser 				= require('body-parser'),
		cookieParser  		= require('cookie-parser'),
		session       		= require('express-session'),
		LocalStrategy 		= require('passport-local').Strategy,
		passport      		= require('passport'),
		db								= require('./db.js'),
		methodOverride 		= require('method-override'),
		logger 						= require('morgan'),
		util 							= require('util'),
		FacebookStrategy	= require('passport-facebook').Strategy;

// ===================================================================
// MODULE SET-UP
// ===================================================================

app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({'extended':true}));
app.use(session({
  secret: 'kimchi ramen',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// SERVER IS RUNNING
app.listen(3000, function() {
	console.log('Server is running!');
});

// ===================================================================
// AUTHENTICATION
// ===================================================================

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
	db.query('SELECT * FROM users WHERE id = $1', [id], function(err, dbRes) {
		if (!err) {
			done(err, dbRes.rows[0]);
		}
	});
});

// DB LOCAL AUTHENTICATION -- not sure I need this anymore?
var localStrategy = new LocalStrategy(
  function(username, password, done) {
    db.query('SELECT * FROM users WHERE username = $1', [username], function(err, dbRes) {
    	var user = dbRes.rows[0];
    	console.log(username)

    	console.log(user);

      if (err) { return done(err); }
      if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
      if (user.password != password) { return done(null, false, { message: 'Invalid password' }); }
      return done(null, user);
    })
  }
);

passport.use(localStrategy);

// FACEBOOK AUTHENTICATION -- finds out: if you have a user; and if you do, you log the user in; but if you don't, you create that user, and then log them in.
passport.use(new FacebookStrategy({
	clientID: "817442341630508",
	clientSecret: "b00d94713bc818694e97e9e83571b134",
	callbackURL: "http://localhost:3000/auth/facebook/callback",
	profileFields: ['id', 'displayName', 'photos'],
	enableProof: false
},
// My note: puts it in the table and returns your websites idea of a user
	function(accessToken, refreshToken, profile, done) {
		console.log('you have logged in');
		db.query("SELECT * FROM users WHERE facebookid = $1", [profile.id], function(err, dbRes) {
			// Checks if user is new or returning user. If it's a new user, puts facebook id into postgres table
			if (!err) {
				var isReturningUser = dbRes.rows.length === 1
				console.log('is returning user:' + isReturningUser);
				if (!isReturningUser) {
					db.query("INSERT INTO users (facebookid, accesstoken) VALUES ($1, $2)", [profile.id, accessToken], function(err, dbRes) {
						if(!err) {
							db.query("SELECT * FROM users WHERE facebookid = $1", [profile.id], function(err, dbRes) {
								var user = dbRes.rows[0];
								return done(err, user)
						  });
					  } else {
					  	console.log('Error happened:' + err);
					  }
					});
				} else {
					var user = dbRes.rows[0];
					return done(err, user);
				}
			}
		});
	}
));

// ===================================================================
// ROUTES: WELCOME PAGE
// ===================================================================

// WELCOME PAGE (USER NOT LOGGED IN)
app.get('/', function(req, res) {
	res.render('index', { user: req.user });
});

// LOG IN VIA FACEBOOK
app.post('/', passport.authenticate('local', {failureRedirect: '/new'}), function(req, res) {
	res.redirect('/rooms');
});

app.get('/auth/facebook',
  passport.authenticate('facebook', { display: 'touch' }));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/garbage' }),
  function(req, res) {
    res.redirect('/');
  });

// LOG OUT
app.delete('/sessions', function(req, res) {
	req.logout();
	res.redirect('/');
});

// ===================================================================
// ROUTES: USER PAGES
// ===================================================================

// USERS VIEWS PROFILE PAGE
app.get('/users/:id', function(req, res) {
	res.render('users/show', { user: req.user });
});

// USER EDITS PROFILE


// PROFILE CHANGES ARE SUBMITTED


// ===================================================================
// ROUTES: ROOM PAGES
// ===================================================================

// USER SEES ALL ROOM POSTINGS
app.get('/rooms', function(req, res) {
	db.query("SELECT * FROM apts;", function(err, dbRes) {
		if(!err) {
			res.render('rooms/index', { rooms: dbRes.rows });
		}
	});
});

// USER CREATES NEW ROOM POSTING
app.get('/rooms/new', function(req, res) {
	console.log('im trying to get a new room!!!! pwweeeeze');
	res.render('rooms/new');
});

// USERS SEES CLICKED-ON POSTING
app.get('/rooms/:id', function(req, res) {
	var loggedIn = req.user !== undefined;
	if (!loggedIn) {
		res.redirect('/');
		return;
	} 
	db.query("SELECT * FROM apts WHERE id = $1", [req.params.id], function(err, dbRes) {
		if(!err) {
			var browsingUserId = req.user.id;
			var owningUserId = dbRes.rows[0].user_id;
			var isOwner = browsingUserId === owningUserId;
			res.render('rooms/show', { room: dbRes.rows[0], user: req.user, isOwner: isOwner });
		}
	});
});

// NEW POSTING IS SUBMITTED
app.post('/rooms', function(req, res) {
	if (req.user) {
		var roomData = [req.body.title, req.body.neighborhood, req.body.price, req.body.open, req.body.description, req.user.id];
		db.query("INSERT INTO apts (title, neighborhood, price, open, description, user_id) VALUES ($1, $2, $3, $4, $5, $6)", roomData, function(err, dbRes) {
			if(!err) {
				res.redirect('/rooms');
			}
		});
	} else {
		res.redirect('/');
	}
});

// AUTHORIZED USER EDITS A ROOM POSTING
app.get('/rooms/:id/edit', function(req, res) {
	db.query("SELECT * FROM apts WHERE id = $1", [req.params.id], function(err, dbRes) {
		if(!err) {
			var browsingUserId = req.user.id;
			var owningUserId = dbRes.rows[0].user_id;
			if(browsingUserId === owningUserId) {
				res.render('rooms/edit', { room: dbRes.rows[0] });	
			} else res.redirect('/notauthorized');
		}
	});
});

// EDITED ROOM POSTING IS SUBMITTED BY AUTH USER
app.patch('/rooms/:id', function(req, res) {
	db.query("UPDATE apts SET title = $1, neighborhood = $2, price = $3, open = $4, description = $5 WHERE id = $6", [req.body.title, req.body.neighborhood, req.body.price, req.body.open, req.body.description, req.params.id], function(err, dbRes) {
		if(!err) {
			res.redirect('/rooms/' + req.params.id);
		} else {
			console.log('//////////////////////');
			console.log(err);
			res.send('ERROR!');
		}
	});
});

// AUTH USER DELETES ROOM POSTING
app.delete('/rooms/:id', function(req, res) {
	db.query("DELETE FROM apts WHERE id = $1", [req.params.id], function(err, dbRes) {
		if(!err) {
			res.redirect('/rooms');
		}
	});
});