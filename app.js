var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var sideQuestRouter = require('./routes/sideQuest');
var mainProjectRouter = require('./routes/mainProject')
var authRouter = require('./routes/auth')

var app = express();
app.use(cors())

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

app.use('/auth', authRouter)

app.use('/sideQuest', sideQuestRouter);
app.use('/mainProject', mainProjectRouter)


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.status(404).send('404: Page not found');
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

/* need to comment out for vercel deployment */
app.listen(4000, () => console.log('Server ready on port 3000.')) 

module.exports = app;
