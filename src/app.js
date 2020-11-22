const sqlite3 = require('sqlite3').verbose();
const dbName = 'highscores';
const dbFilePath = './db/' + dbName + '.db';

const express = require("express");
var app = express();
var bodyParser = require("body-parser");

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
  db.run('CREATE TABLE IF NOT EXISTS highscores(name text, score integer, date integer)');
}

function HighScore(name, score, date) {
  this.name = name;
  this.score = score;
  this.date = date;
}

async function readHighScores() {
  let sql = `SELECT name, score, date FROM highscores
           ORDER BY score desc`;

  let responseObj;
  return new Promise(function (resolve, reject) {
    db.all(sql, [], function (err, rows) {
      if (err) {
        responseObj = {
          'error': err
        };
        reject(responseObj);
      }
  
      let allHighScores = [];
      rows.forEach((row) => {
        let highScore = new HighScore(row.name, row.score, row.date);
        allHighScores.push(highScore);
      });
  
      console.log('rhs 1 ready');
      resolve(allHighScores);
    });
  });

}

function closeDatabase() {
  // close the database connection
  db.close((err) => {
    if (err) {
      return console.error('Error closing db: ' + err.message);
    }
    console.log('Close the database connection.');
  });
}

main();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(APP_PORT, () => {
  console.log("Highscore server running on port " + APP_PORT);
});

app.get("/highscores/all", async (req, res, next) => {
  /*
  let allHighScores = await readHighScores();
  res.json(allHighScores);
  */
  readHighScores().then((allHighScores) => {
    console.log('allHighScores: ' + allHighScores);
    res.json(allHighScores);
  });

  console.log('get ready');

});