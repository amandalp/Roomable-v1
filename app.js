var 	express 			= require('express'),
		ejs 				= require('ejs'),
		app					= express(),
		path				= require('path'),
		bodyParser 			= require('body-parser'),
		cookieParser  		= require('cookie-parser'),
		session       		= require('express-session'),
		LocalStrategy 		= require('passport-local').Strategy,
		passport      		= require('passport'),
		db					= require('./db.js'),
		methodOverride 		= require('method-override'),
		logger 				= require('morgan'),
		util 				= require('util'),
		FacebookStrategy	= require('passport-facebook').Strategy;
//		fb 					= require('./fb.js');


app.set('view engine', 'ejs');
app.use(methodOverride('_method'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({'extended':true}));
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));


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

app.listen(3000, function() {
	console.log('Server is running!');
});


// Local login, but may not need this anymore!
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


// OAuth Passport Facebook
// finds out if you have a user and if you do, you log the user in, but if you don't you create that user, and then log them in.

passport.use(new FacebookStrategy({
	clientID: "817442341630508",
	clientSecret: "b00d94713bc818694e97e9e83571b134",
	callbackURL: "http://localhost:3000/auth/facebook/callback",
	profileFields: ['id', 'displayName', 'photos'],
	enableProof: false
},
	function(accessToken, refreshToken, profile, done) {
		db.query("SELECT * FROM users WHERE facebookid = $1", [profile.id], function(err, dbRes) {
			if (!err) {
				console.log('User fetched from db!');
				var user = dbRes.rows[0];

				if (user) {
					console.log('User found and should be logged in!');
					return done(err, user);
				} else {
					console.log('Registering user!');
					db.query("INSERT INTO users (facebookid) VALUES ($1)", [profile.id], function(err, dbRes) {
						if (!err) {
							console.log('User registered!');
							db.query("SELECT * FROM users WHERE facebookid = $1", [profile.id], function(err, dbRes) {
								console.log('User logged in after registration');
								var user = dbRes.rows[0];
								return done(err, user);
							});
						}
					});
				}
				// var user = dbRes.rows[0];
				// console.log(user);
				// return done(err, user);
			}
		});
	}
));


// Starting Routes

app.get('/', function(req, res) {
	res.render('index', { user: req.user });
});

app.post('/', passport.authenticate('local', {failureRedirect: '/new'}), function(req, res) {
	res.redirect('/rooms');
});

// Facebook Auth Routes

app.get('/auth/facebook',
  passport.authenticate('facebook', { display: 'touch' }));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/garbage' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.delete('/sessions', function(req, res) {
	req.logout();
	res.redirect('/');
});

// Room Routes

app.get('/rooms/new', function(req, res) {
	res.render('rooms/new');
});

app.get('/rooms', function(req, res) {
	db.query("SELECT * FROM apts;", function(err, dbRes) {
		if(!err) {
			res.render('rooms/index', { rooms: dbRes.rows });
		}
	});
});

app.get('/rooms/:id', function(req, res) {
	db.query("SELECT * FROM apts WHERE id = $1", [req.params.id], function(err, dbRes) {
		if(!err) {
			res.render('rooms/show', { room: dbRes.rows[0] });
		}
	});
});

app.post('/rooms', function(req, res) {
	// If the user is logged in
	if (req.user) {
		var params = [req.body.title, req.body.neighborhood, req.body.price, req.body.open, req.body.description, req.user.id];
		db.query("INSERT INTO apts (title, neighborhood, price, open, description, user_id) VALUES ($1, $2, $3, $4, $5, $6)", params, function(err, dbRes) {
			if(!err) {
				res.redirect('/rooms');
			}
		});
	} else {
		res.redirect('/');
	}
});

app.get('/rooms/:id/edit', function(req, res) {
	db.query("SELECT * FROM apts WHERE id = $1", [req.params.id], function(err, dbRes) {
		if(!err) {
			res.render('rooms/edit', { room: dbRes.rows[0] });
		}
	});
});

app.patch('/rooms/:id', function(req, res) {
	db.query("UPDATE apts SET title = $1, neighborhood = $2, price = $3, open = $4, description = $5 WHERE id = $6", [req.body.title, req.body.neighborhood, req.body.price, req.body.open, req.body.description, req.params.id], function(err, dbRes) {
		if(!err) {
			res.redirect('/rooms/' + req.params.id);
		} else {
			// console.log('UPDATE apts SET title = ' + req.body.title + ', neighborhood = ' + req.body.neighborhood + ', price = '  ', open = $4, description = $5 WHERE id = $7')
			console.log('//////////////////////');
			console.log(err);
			res.send('ERROR!');
		}
	});
});

app.delete('/rooms/:id', function(req, res) {
	db.query("DELETE FROM apts WHERE id = $1", [req.params.id], function(err, dbRes) {
		if(!err) {
			res.redirect('/rooms');
		}
	});
});