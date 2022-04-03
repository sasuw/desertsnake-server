const sqlite3 = require('sqlite3').verbose();
const dbName = 'highscores';
const dbFilePath = './db/' + dbName + '.db';

const express = require("express");
var app = express();
var bodyParser = require("body-parser");
const cors = require('cors');
const rateLimit = require("express-rate-limit");
const requestIp = require('request-ip');

const APP_PORT = 3001;

var db; 

function main() {
  prepareDatabase();
  initDatabase();
  //readHighScores();
  //closeDatabase();
}

function prepareDatabase() {
  db = new sqlite3.Database(dbFilePath, (err) => {
    if (err) {
      console.error('Error opening db: ' + err.message);
      if (err.message.includes('SQLITE_CANTOPEN')) {
        console.log('Creating database');

        db = new sqlite3.Database(dbFilePath,
          sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
          (err) => {
            console.error('Error creating db: ' + err.message);
          });
      }
    }
    console.log('Connected to the ' + dbName + ' database.');
  });
}

function initDatabase() {
  db.run('CREATE TABLE IF NOT EXISTS highscores(name text, score integer, date integer, ipSource text)');
}

function contentFilter(input){
  if(input == null || input === ''){
    return input;
  }
  
  let output = input;

  let offensiveContentMap = {
    'fick': 'chic',
    'motherfuck': 'motherkiss',
    'shit': 'mint',
    'piss': 'miss',
    'cock': 'duck',
    'sucker': 'rocker',
    'cunt': 'slot',
    'fuck': 'duck',
    'scheisse': 'narzisse',
    'gay': 'joy',
    'lesbian': 'martian',
    'pornhub': 'cornrub',
    'porn': 'corn',
    'sex': 'hex',
    'anal': 'lana',
    'tits': 'bits',
    'titten': 'ratten',
    'schwul': 'konsul',
    'schwuchtel': 'pelzmantel',
    '<': '|',
    '>': '|',
    'http': 'link',
    'fotze': 'katze',
    'neger': 'gerne',
    'nigger': 'ginger',
    'hitler': 'merkel',
    'pussy': 'kittn'
  }

  for (const [key, value] of Object.entries(offensiveContentMap)) {
    if(output.toLocaleLowerCase().includes(key)){
      let regExp = new RegExp(key, 'g');
      output = output.replace(regExp, value);
    }
  }

  return output;
}

function HighScore(name, score, date) {
  this.originalName = name;
  this.name = contentFilter(name);
  this.score = score;
  this.date = convertMilliSecondsToSeconds(parseInt(date, 10));;
}

HighScore.prototype.toString = function(){
  return 'HighScore: ' + this.name + ' | ' + this.score + ' | ' + this.date;
}

HighScore.prototype.fromJson = function(jsonBody){
  this.name = jsonBody.name;
  this.score = jsonBody.score;
  this.date = convertMilliSecondsToSeconds(parseInt(jsonBody.date, 10));

  return this;
}

function dbRead(sql) {
  let responseObj;
  return new Promise(function (resolve, reject) {
    db.all(sql, [], function (err, rows) {
      if (err) {
        reject(err);
      }

      let allHighScores = [];
      rows.forEach((row) => {
        let highScore = new HighScore(row.name, row.score, row.date);
        allHighScores.push(highScore);
      });

      resolve(allHighScores);
    });
  });
}

function dbInsert(sql, params) {
  return new Promise(function (resolve, reject) {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      }

      console.log('A row has been inserted with rowid ' + this.lastID);

      resolve(this.lastID);
    });
  });
}

function dbReadHighScoresAll() {
  let sql = 'SELECT name, score, date FROM highscores ORDER BY score desc, date desc, name asc';
  return dbRead(sql);
}

function dbReadHighScoresTop10() {
  let sql = 'SELECT name, score, date FROM highscores ORDER BY score desc, date desc, name asc LIMIT 10';
  return dbRead(sql);
}

function dbInsertHighScore(highScore, ipSource) {
  let sql = 'INSERT INTO highscores (name, score, date, ipSource) VALUES (?, ?, ?, ?)';
  let params = [highScore.name, highScore.score, highScore.date, ipSource];
  return dbInsert(sql, params);
}

function closeDatabase() {mar
  // close the database connection
  db.close((err) => {
    if (err) {
      return console.error('Error closing db: ' + err.message);
    }
    console.log('Close the database connection.');
  });
}

main();

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 8 * 10 // limit each IP to 40 requests per windowMs
});
app.use(limiter);

app.use(requestIp.mw())

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var corsOptionsProd = {
  origin: 'https://snake.sasu.net',
  optionsSuccessStatus: 200 // For legacy browser support
}

var corsOptionsDev = {
  origin: 'http://localhost:8000',
  optionsSuccessStatus: 200 // For legacy browser support
}

if(process.env.NODE_ENV.startsWith('dev')){
  console.log('Starting in DEV');
  app.use(cors(corsOptionsDev));
}else{
  console.log('Starting in PROD');
  app.use(cors(corsOptionsProd));
}


app.listen(APP_PORT, () => {
  console.log("Highscore server running on port " + APP_PORT);
});

app.get("/highscore/all", async (req, res, next) => {
  dbReadHighScoresAll().then((allHighScores) => {
    console.log('allHighScores: ' + allHighScores);
    res.json(allHighScores);
  }, (err) => {
    console.error('Error reading all highscores: ' + err);
    res.sendStatus(500);
    res.end();
  });
});

app.get("/highscore/top10", async (req, res, next) => {
  dbReadHighScoresTop10().then((top10HighScores) => {
    console.log('top10HighScores: ' + top10HighScores);
    res.json(top10HighScores);
  }, (err) => {
    console.error('Error reading top10 highscores: ' + err);
    res.sendStatus(500);
    res.end();
  });
});

app.post("/highscore", async (req, res, next) => {
  console.log('ip: ' + req.clientIp);

  let reqBody = req.body;

  if(reqBody.name == null || reqBody.score == null || reqBody.date == null){
    console.log('Submitted highscore rejected, no content');
    res.sendStatus(400);
    res.end();
    return;
  }

  let highScore = new HighScore(reqBody.name, reqBody.score, reqBody.date);

  if(highScore.score > 1000){
    console.log('Submitted highscore rejected, unbelievably high: ' + highScore.score);
    res.sendStatus(400);
    res.end();
    return;
  }

  let serverNow = convertMilliSecondsToSeconds(Date.now());
  let highScoreNow = highScore.date;

  console.log('Server now: ' + serverNow);
  console.log('High score now: ' + highScoreNow);

  if(Math.abs(serverNow - highScoreNow)  > 300){
    console.log('Submitted highscore rejected, suspicious date');
    res.sendStatus(400);
    res.end();
    return;
  }

  dbInsertHighScore(reqBody, req.clientIp).then(() => {
    let newHighScore = reqBody;
    if(reqBody.length > 10){
      console.warn('Highscore was too long: ' + newHighScore.length + ', shortening to 10 characters.');
      newHighScore = newHighScore.substr(0, 10); 
      console.warn('Highscore after shortening: ' + newHighScore);
    }
    let hs = new HighScore().fromJson(reqBody);
    console.log('Inserted new high score: ' + hs.toString());

    res.sendStatus(200);
    res.end();
  }, (err) => {
    console.error('Error saving highscore: ' + err);
    res.sendStatus(500);
    res.end();
  });
});

function convertMilliSecondsToSeconds(ms){
  return Math.round(ms/1000);
}