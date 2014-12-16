var express 			= require('express'),
		ejs 			= require('ejs'),
		app				= express(),
		path			= require('path'),
		bodyParser 		= require('body-parser'),
		cookieParser  	= require('cookie-parser'),
		session       	= require('express-session'),
		LocalStrategy 	= require('passport-local').Strategy,
		passport      	= require('passport'),
		db				= require('./db.js'),
		methodOverride 	= require('method-override');

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

// Routy Routes :) ^^ ^3^ :0 :p

app.get('/', function(req, res) {
	res.render('index', { user: req.user });
});

app.post('/', passport.authenticate('local', {failureRedirect: '/new'}), function(req, res) {
	res.redirect('/rooms');
});

app.delete('/', function(req, res) {
	req.logout();
	res.redirect('/');
});

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
	db.query("UPDATE apts SET title = $1, neighborhood = $2, price = $3, open = $4, description = $5, WHERE id = $7", [req.body.title, req.body.neighborhood, req.body.price, req.body.open, req.body.description, req.params.id], function(err, dbRes) {
		if(!err) {
			res.redirect('/rooms/' + req.params.id);
		} else {
			console.log('//////////////////////');
			console.log(req.params.id);
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

























