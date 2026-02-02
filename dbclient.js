//import sqlite3
const sqlite3 = require("sqlite3").verbose();

// Open or create database file
const connect = (name) => {
  return new sqlite3.Database(name, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Connected to database.");
    }
  });
};

//create table
const create = (db, sql) => {
  db.serialize(() => {
    db.run(sql);
  });
};

//insert data into table
const insert = (db, sql, data) => {
  db.run(sql, Object.values(data), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Insert data success");
    }
  });
};
//read data from table
const read = (db, sql, params, callback) => {
  db.get(sql, params, (err, row) => {
    if (err) {
      console.error(err);
      callback(err, null);
    } else {
      callback(null, row);
    }
  });
};

module.exports = { connect, create, insert,read };
