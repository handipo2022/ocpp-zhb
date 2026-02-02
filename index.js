const express = require("express");
const dbase = require("./dbclient.js");

const app = express();
const port = 3000;

const name = "./charger.db";

const chargerdata = `CREATE TABLE IF NOT EXISTS chargerdata (
      id INTEGER PRIMARY KEY,
      chargeBoxSerialNumber TEXT,
      chargePointModel TEXT,
      chargePointSerialNumber TEXT,
      chargePointVendor TEXT,
      firmwareVersion TEXT,
      iccid TEXT,
      imsi TEXT,
      meterSerialNumber TEXT,
      meterType TEXT
      
    )`;

const ocpp = `CREATE TABLE IF NOT EXISTS ocpp (     
      id INTEGER PRIMARY KEY,
      url TEXT,
      chargerid TEXT,
      numgun TEXT      
    )`;

const db = dbase.connect(name); //connect dbase
dbase.create(db, chargerdata); //create table 'chargerdata'
dbase.create(db, ocpp); //create table 'ocpp'

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/detailcp/loaddata", async (req, res) => {
  try {
    const sql = `SELECT * FROM chargerdata WHERE id = ?`;
    dbase.read(db, sql, [1], (err, row) => {
      if (err) {
        console.error("Error:", err);
        return res.status(500).send({ error: "Database query failed" });
      } else if (!row) {
        console.log("Data not found");
        return res.status(404).send({ error: "Data not found" });
      } else {
        console.log("Data:", row);
        // kirim langsung sebagai JSON
        return res.status(200).json(row);
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).send();
  }
});

app.get("/ocpp/loaddata", async (req, res) => {
  try {
    const sql = `SELECT * FROM ocpp WHERE id = ?`;
    dbase.read(db, sql, [1], (err, row) => {
      if (err) {
        console.error("Error:", err);
        return res.status(500).send({ error: "Database query failed" });
      } else if (!row) {
        console.log("Data not found");
        return res.status(404).send({ error: "Data not found" });
      } else {
        console.log("Data:", row);
        // kirim langsung sebagai JSON
        return res.status(200).json(row);
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).send();
  }
});
app.post("/detailcp/savedata", async (req, res) => {
  const {
    cbsn,
    cpmodel,
    cpsn,
    cpvendor,
    fwversion,
    iccid,
    imsi,
    metersn,
    metertype,
  } = req.body;

  try {
    const sql = `
    INSERT OR REPLACE INTO chargerdata (
      id,  
      chargeBoxSerialNumber,
      chargePointModel,
      chargePointSerialNumber,
      chargePointVendor,
      firmwareVersion,
      iccid,
      imsi,
      meterSerialNumber,
      meterType
    ) VALUES (1,?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const values = [
      cbsn,
      cpmodel,
      cpsn,
      cpvendor,
      fwversion,
      iccid,
      imsi,
      metersn,
      metertype,
    ];

    dbase.insert(db, sql, values);
    res.status(200).send();
  } catch (err) {
    console.log(err);
    res.status(500).send();
  }
});

app.post("/ocpp/savedata", async (req, res) => {
  const { url, chargerid, numgun } = req.body;

  try {
    const sql = `
    INSERT OR REPLACE INTO ocpp (
      id,  
      url,
      chargerid,
      numgun
      
    ) VALUES (1,?, ?, ?)
  `;

    const values = [url, chargerid, numgun];

    dbase.insert(db, sql, values);
    res.status(200).send();
  } catch (err) {
    console.log(err);
    res.status(500).send();
  }
});

app.listen(port, () => {
  console.log(`Webserver ready on port ${port}`);
});
