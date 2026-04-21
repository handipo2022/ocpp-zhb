const express = require("express");
const dbase = require("./dbclient.js");
const ocppClient = require("./ocppclient.js");

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
const connector = `CREATE TABLE IF NOT EXISTS connector (     
      id INTEGER PRIMARY KEY,
      connectorId INTEGER,
      status TEXT,
      errorCode TEXT      
    )`;

const configuration = `CREATE TABLE IF NOT EXISTS configuration (     
      id INTEGER PRIMARY KEY,
      AllowOfflineTxForUnknownId BOOLEAN,
      AuthorizationCacheEnabled BOOLEAN,
      AuthorizeRemoteTxRequests BOOLEAN,
      BlinkRepeat INTEGER,
      ClockAlignedDataInterval INTEGER,
      ConnectionTimeOut INTEGER,
      GetConfigurationMaxKeys INTEGER,
      HeartbeatInterval INTEGER,
      LightIntensity INTEGER,
      LocalAuthorizeOffline BOOLEAN,
      LocalPreAuthorize BOOLEAN,
      MaxEnergyOnInvalidId INTEGER,
      MeterValuesAlignedData TEXT,
      MeterValuesSampledData TEXT,
      MeterValueSampleInterval INTEGER,
      MinimumStatusDuration INTEGER,
      NumberOfConnectors INTEGER,
      ResetRetries INTEGER,
      ConnectorPhaseRotation TEXT,
      StopTransactionOnEVSideDisconnect BOOLEAN,
      StopTransactionOnInvalidId BOOLEAN,
      StopTxnAlignedData TEXT,
      StopTxnSampledData TEXT,
      SupportedFeatureProfiles TEXT, 
      TransactionMessageAttempts INTEGER,
      TransactionMessageRetryInterval INTEGER,
      UnlockConnectorOnEVSideDisconnect BOOLEAN,
      WebSocketPingInterval INTEGER
    )`;

const db = dbase.connect(name); //connect dbase
dbase.create(db, chargerdata); //create table 'chargerdata'
dbase.create(db, ocpp); //create table 'ocpp'
dbase.create(db, connector); //create table 'connector'
dbase.create(db, configuration); //create table 'configuration'

ocppClient.main();

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

    // Delete all existing connectors
    const deleteSql = `DELETE FROM connector`;
    await dbase.run(db, deleteSql);
    //renew connector
    for (let j = 1; j <= numgun; j++) {
      const sql1 = `
        INSERT INTO connector (
          id,  
          connectorId,
          status,
          errorCode      
        ) VALUES (?, ?, ?, ?)
      `;
      const values1 = [j, j, "Available", "NoError"];
      await dbase.insert(db, sql1, values1);
    }

    res.status(200).send();
  } catch (err) {
    console.log(err);
    res.status(500).send();
  }
});

app.listen(port, () => {
  console.log(`Webserver ready on port ${port}`);
});
