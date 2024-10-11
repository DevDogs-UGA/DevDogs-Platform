import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import logger from 'morgan';
import cors from 'cors';
import indexRouter from './routes/index.js';
import sideQuestRouter from './routes/sideQuest.js';
import mainProjectRouter from './routes/mainProject.js';
import authRouter from './routes/auth.js';
import testEnvRouter from './routes/test-env.js';

var app = express();
app.use(cors())

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(bodyParser.json());

app.use('/', indexRouter);
app.use('/auth', authRouter)

app.use('/sideQuest', sideQuestRouter);
app.use('/mainProject', mainProjectRouter)
app.use('/testing', testEnvRouter)


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
// app.listen(3000, () => console.log('Server ready on port 3000.'))

export default app;