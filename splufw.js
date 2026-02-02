//SPLU FIRMWARE --> RASPI
//1. KWH METER USING ACREL ADL400 , COMM VIA MODBUS RTU
//2. WAVESHARE MODBUS RTU RELAY 8 CHANNEL
//3. RFID
//client v1.0.1
//revisi log :

//1. Add further check & processing for  AuthorizeOffline dan AllowOfflineTxForUnknownId
//2. Add time inside logocpp.txt
//3. fix operative/inoperative mode
//OCPP Client  v1.0.0
//By : Handipo
//added:
//AllowOfflineTxForUnknownId --> when enabled, charging will do using any rfid card. Start & stop on invalid id
//AllowAuthorizationCacheEnabled --> when enabled, will save any tap rfid card into database (Authorization Cache)
//AuthorizeRemoteTxRequests --> NotSupported
//BlinkRepeat --> NotSupported
//ClockAlignedDataInterval --> NotSupported
//ConnectionTimeOut --> check for plug connection after interval time out set. If no plugOn, then cut charging
//HeartbeatInterval --> send Heartbeat.req every interval time set
//LightIntensity --> NotSupported
//LocalPreAuthorize --> when enabled, in online mode, rfid card which is in AuthorizationCache will be permitted to trigger charging.
//LocalAuthorizeOffline --> when enable  will allow charging in offline mode, as long as rfid used already registered
//MeterValueSampleInterval --> send meter value each interval set --> fix: update database from ocpp(online) and offline
//MeterValuesSampledData --> add measurand on Metervalue.req.
//MeterValue.req --> add value, measurand, context, unit. Follow measurand set on MetersValuesSampledData
//Grab metervalue each interval meter value set
//MinimumStatusDuration ---> do delay /timeout before execute StatusNotification.req
//ConnectorPhaseRotation -->NotSupported
//ResetRetries --> times reset trial after unsuccessfull Reset --> PENDING, first should find how to Reset
//StopTransactionOnEvDisconnected --> when enabled, will stop transaction if gun plugged off during charging-->PENDING, need to make differences when plugon or plugoff in the middle of charging (valid when PWM 40% and 50%)
//ClearCache --> Delete data inside table 'authorizationcache'
//UnlockConnector --> on respon, disconnect CP pwm signal
//GetDiagnostic --> can upload diagnostic file to FTP server . Give path (directory in FTP server) inside FTP address. Save tx/rx ocpp cmd between CS and CP. save into logocpp.txt
//Reset  --> reset websocket
//Add feature -- > cek if there is internet connection. If there, continue to build websocket connection. Otherwise, will read inet conn every 5 seconds
//UpdateFirmware --> download Firmware file from referred URL, save in raspi folder
//SendLocalList --> mode Differential --> respon NotSupported
//SendLocalList --> mode Full --> Send Empty --> all record in table locallist removed
//SendLocalList --> mode Full --> all existing record removed than insert new record in table locallist
//GetLocalListVersion --> read listVersion in table locallist , then send response to server
//Other request from CS to CP, CP will give response ocpp message to CS but no further action in CP , as described below :
//ReserveNow --> response : Rejected
//CancelReservation --> response : Rejected
//GetCompositeModule --> response : Rejected
//DataTransfer --> response : Rejected
//ClearChargingProfile --> response : Unknown
//SetChargingProfile --> response : NotSupported
//Current limit set via webui --> Jumper, 6A,10A,16A,18A,24A,32A. If in Jumper mode, then PWM value is set depend on jumper hardware setting

//LocalAuthorizeOffline = true --> saat offline, maka charger diijinkan start transaction dgn RFID yg sudah terdaftar
//AllowOfflineTxForUnknownId=true --> saat offline,maka charger diijinkan start transaction dgn SEMBARANG RFID!

//import modbus-serial
const ModbusRTU = require("modbus-serial");
const mbconn = new ModbusRTU();
const portRTU = "COM3";
let mbsStatus = "Initializing..."; // holds a status of Modbus

// Modbus 'state' constantsd
const MBS_STATE_INIT = "State init";
const MBS_STATE_IDLE = "State idle";
const MBS_STATE_NEXT = "State next";
const MBS_STATE_GOOD_READ = "State good (read)";
const MBS_STATE_FAIL_READ = "State fail (read)";
const MBS_STATE_GOOD_CONNECT = "State good (port)";
const MBS_STATE_FAIL_CONNECT = "State fail (port)";

// Modbus configuration values
const mbsId = 1;
const mbsScan = 10000;
const mbsTimeout = 10000;
let mbsState = MBS_STATE_INIT;

// import basic-ftp
const ftp = require("basic-ftp");
const fs = require("fs/promises");
//const isOnline = require("is-online");
const checkInternetConnected = require("check-internet-connected");

var http = require("http"); //import http module
var port = 3000; //port webserver
var dbconn = require("./dbase.js"); //call database connection module

// const { SerialPort } = require("serialport"); //import serial module
// var comport = "COM7"; //serial comm port
// var serialport = new SerialPort({
//   //setting comm port
//   path: comport,
//   baudRate: 9600,
//   autoOpen: true,
// });

//server use is ocpp steve
var WebSocketClient = require("websocket").client; //import websocket module
var sessionstorage = require("sessionstorage"); //import sessionstorage module
// const fs = require("fs");

var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var id = randonId();

let client = new WebSocketClient();
let endpointurl = "";
let idcp = "";
let objmsg;
let interval;
let meterkwhvaluestr = "";
let meterkwhvalue;
let metervoltage;
let meterfreq;
let meterpower;
let meterpf;
let metercurrent;
let refreshmetervalue;
let refreshmetervaluearray;
let tempIdToken;
let ftplocation;
let flagConnect;
let ctratio = 4;
let idintervalArray = [6];
let currentTx = [
  { id: 1, txid: 0, idinterval: 0 },
  { id: 2, txid: 0, idinterval: 0 },
  { id: 3, txid: 0, idinterval: 0 },
  { id: 4, txid: 0, idinterval: 0 },
  { id: 5, txid: 0, idinterval: 0 },
  { id: 6, txid: 0, idinterval: 0 },
];
let connectorstatus;
let switchposition;
let savetempstring;
let measurandarray;
let connectorId = 1;
let transId;
let len;
let IdToken = "";
let CPModel = "";
let CPVendor = "";
let CBoxNum = "";
let CPNum = "";
let fwVersion = "";
let iccid = "";
let imsi = "";
let meterType = "";
let meterSN = "";
let tempstring = "";
let idinterval;
let currentlimit;
let minimumstatusduration;
let stoptransactiononevdisconnect;
let stoptransactiononinvalidid;
let idinterval2;
let plugstatusstr = "plugOff";
let cperrorcode = "";
let cpstatus = "";
let rfidTranscStatus = "";
let intervalMeterValue;
let readKeyConfig;
let readValueConfig;
let mysqlstr;
let data;
let sliceString;
let metervaluearray;
let allowofflinetxforunknownid;
let authorizationcacheenabled;
let intervaltimeout;
let heartbeatinterval;
let localauthorizeoffline;
let localpreauthorize;
let elementarray = [];
let foundElement;
let server;
let addrMBArray;
let flagRemoteStart = false; //marking flag used for running RemoteStartTransaction.conf once
let flagRemoteStop = false; //marking flag used for running RemoteStopTransaction.conf once
let flagRemoteStartBegin = false; //marking flag used for running StartTransaction.req once (Remote Start Transaction)
let flagRemoteStopBegin = false; //marking flag used for running StopTransaction.req once (Remote Stop Transaction)
let CPConfiguration = [
  { key: "AllowOfflineTxForUnknownId", value: "Accepted" },
  { key: "AuthorizationCacheEnabled", value: "Accepted" },
  { key: "AuthorizeRemoteTxRequests", value: "NotSupported" },
  { key: "BlinkRepeat", value: "NotSupported" },
  { key: "ClockAlignedDataInterval", value: "NotSupported" },
  { key: "ConnectionTimeOut", value: "Accepted" },
  { key: "ConnectorPhaseRotation", value: "NotSupported" },
  { key: "HeartbeatInterval", value: "Accepted" },
  { key: "LightIntensity", value: "NotSupported" },
  { key: "LocalAuthorizeOffline", value: "Accepted" },
  { key: "LocalPreAuthorize", value: "Accepted" },
  { key: "MaxEnergyOnInvalidId", value: "NotSupported" },
  { key: "MeterValuesAlignedData", value: "NotSupported" },
  { key: "MeterValuesSampledData", value: "Accepted" },
  { key: "MeterValueSampleInterval", value: "Accepted" },
  { key: "MinimumStatusDuration", value: "Accepted" },
  { key: "ResetRetries", value: "Accepted" },
  { key: "StopTransactionOnEVSideDisconnect", value: "Accepted" },
  { key: "StopTransactionOnInvalidId", value: "NotSupported" },
  { key: "StopTxnAlignedData", value: "NotSupported" },
  { key: "StopTxnSampledData", value: "NotSupported" },
  { key: "TransactionMessageAttempts", value: "NotSupported" },
  { key: "TransactionMessageRetryInterval", value: "NotSupported" },
  { key: "UnlockConnectorOnEVSideDisconnect", value: "NotSupported" },
  { key: "WebSocketPingInterval", value: "NotSupported" },
  { key: "GetConfigurationMaxKeys", value: "Rejected" },
  { key: "MeterValuesAlignedDataMaxLength", value: "Rejected" },
  { key: "MeterValuesSampledDataMaxLength", value: "Rejected" },
  { key: "NumberOfConnectors", value: "Accepted" },
  { key: "ConnectorPhaseRotationMaxLength", value: "Rejected" },
  { key: "StopTxnAlignedDataMaxLength", value: "Rejected" },
  { key: "StopTxnSampledDataMaxLength", value: "Rejected" },
  { key: "SupportedFeatureProfiles", value: "Rejected" },
  { key: "SupportedFeatureProfilesMaxLength", value: "Rejected" },
  { key: "LocalAuthListMaxLength", value: "Rejected" },
  { key: "SendLocalListMaxLength", value: "Rejected" },
  { key: "ReserveConnectorZeroSupported", value: "Rejected" },
  { key: "ChargeProfileMaxStackLevel", value: "Rejected" },
  { key: "ChargingScheduleAllowedChargingRateUnit", value: "Rejected" },
  { key: "ChargingScheduleMaxPeriods", value: "Rejected" },
  { key: "ConnectorSwitch3to1PhaseSupported", value: "Rejected" },
  { key: "MaxChargingProfilesInstalled", value: "Rejected" },
];
//************************************************************************************* */
//create web server
setTimeout(() => {
  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*"); //support cross domain
    res.setHeader(
      "Access-Control-Allow-Methods",
      "OPTIONS,POST,GET,DELETE,UPDATE"
    );

    
    if (req.url == "/relaystatus/update") {
      //load relaystatus from database
      mysqlstr = "select switchpos from connector";
      dbconn.query(mysqlstr, (err, results, fields) => {
        res.end(JSON.stringify(results)); //send response
      });
    }
    if (req.url == "/detailcp/loaddata") {
      //load CP data from database
      mysqlstr = "select * from detailcp";
      dbconn.query(mysqlstr, (err, results, fields) => {
        res.end(JSON.stringify(results)); //send response
      });
    }

    if (req.url == "/detailcp/savedata") {
      //save CP data to database
      data = "";

      req.on("data", (chunk) => {
        data += chunk; //get sent data request in JSON format
        endpointurl = JSON.parse(data).endpoint.toString();
        idcp = JSON.parse(data).cbid.toString();
        CPModel = JSON.parse(data).cpmodel.toString(); //parse to object then convert as string
        CPVendor = JSON.parse(data).cpvendor.toString(); //parse to object then convert as string
        CBoxNum = JSON.parse(data).cbsn.toString(); //parse to object then convert as string
        CPNum = JSON.parse(data).cpsn.toString(); //parse to object then convert as string
        fwVersion = JSON.parse(data).fwversion.toString(); //parse to object then conveturnrelayonrt as string
        iccid = JSON.parse(data).iccid.toString(); //parse to object then convert as string
        imsi = JSON.parse(data).imsi.toString(); //parse to object then convert as string
        meterType = JSON.parse(data).metertype.toString(); //parse to object then convert as string
        meterSN = JSON.parse(data).metersn.toString(); //parse to object then convert as string
        currentlimit = JSON.parse(data).currentlimit.toString();
        //sql command for update data
        mysqlstr =
          "update detailcp set endpointurl = " +
          "'" +
          endpointurl +
          "'" +
          "," +
          "chargeboxid = " +
          "'" +
          idcp +
          "'" +
          "," +
          "cboxnum = " +
          "'" +
          CBoxNum +
          "'" +
          "," +
          "cpmodel = " +
          "'" +
          CPModel +
          "'" +
          "," +
          "cpnum = " +
          "'" +
          CPNum +
          "'" +
          "," +
          "cpvendor = " +
          "'" +
          CPVendor +
          "'" +
          "," +
          "fwversion = " +
          "'" +
          fwVersion +
          "'" +
          "," +
          "iccid = " +
          "'" +
          iccid +
          "'" +
          "," +
          "imsi = " +
          "'" +
          imsi +
          "'" +
          "," +
          "metersn = " +
          "'" +
          meterSN +
          "'" +
          "," +
          "metertype = " +
          "'" +
          meterType +
          "'" +
          "," +
          "currentlimit = " +
          "'" +
          currentlimit +
          "'" +
          " where id = " +
          "'" +
          2 +
          "'";

        dbconn.query(mysqlstr, function (err, res) {
          if (err) throw err;
          console.log("data updated!!");
        });
      });
      res.end("1 record inserted");
    }

    if (req.url == "/configcp/getconfiguration") {
      //load Configuration data from database
      mysqlstr = "select * from configcp";
      dbconn.query(mysqlstr, (err, results, fields) => {
        res.end(JSON.stringify(results)); //send response
      });
    }

    if (req.url == "/configcp/readconfiguration") {
      //load Configuration data from database
      mysqlstr = "select * from configcp";
      dbconn.query(mysqlstr, (err, results, fields) => {
        res.end(JSON.stringify(results)); //send response
      });
    }

    if (req.url == "/configcp/changeconfiguration") {
      //save CP data to database
      data = "";

      req.on("data", (chunk) => {
        data += chunk; //get sent data request in JSON format

        var AllowOfflineTxForUnknownId;
        if (JSON.parse(data).AllowOfflineTxForUnknownId.toString() == "true") {
          AllowOfflineTxForUnknownId = 1;
        } else if (
          JSON.parse(data).AllowOfflineTxForUnknownId.toString() == "false"
        ) {
          AllowOfflineTxForUnknownId = 0;
        }

        var AuthorizationCacheEnabled;
        if (JSON.parse(data).AuthorizationCacheEnabled.toString() == "true") {
          AuthorizationCacheEnabled = 1;
        } else if (
          JSON.parse(data).AuthorizationCacheEnabled.toString() == "false"
        ) {
          AuthorizationCacheEnabled = 0;
        }
        var AuthorizeRemoteTxRequests;
        if (JSON.parse(data).AuthorizeRemoteTxRequests.toString() == "true") {
          AuthorizeRemoteTxRequests = 1;
        } else if (
          JSON.parse(data).AuthorizeRemoteTxRequests.toString() == "false"
        ) {
          AuthorizeRemoteTxRequests = 0;
        }

        var BlinkRepeat = JSON.parse(data).BlinkRepeat.toString(); //parse to object then convert as string
        var ClockAlignedDataInterval =
          JSON.parse(data).ClockAlignedDataInterval.toString(); //parse to object then convert as string
        var ConnectionTimeOut = JSON.parse(data).ConnectionTimeOut.toString(); //parse to object then convert as string
        var HeartbeatInterval = JSON.parse(data).HeartbeatInterval.toString(); //parse to object then convert as string
        var LightIntensity = JSON.parse(data).LightIntensity.toString(); //parse to object then convert as string

        var LocalAuthListEnabled;
        if (JSON.parse(data).LocalAuthListEnabled.toString() == "true") {
          LocalAuthListEnabled = 1;
        } else if (
          JSON.parse(data).LocalAuthListEnabled.toString() == "false"
        ) {
          LocalAuthListEnabled = 0;
        }

        var LocalAuthorizeOffline;
        if (JSON.parse(data).LocalAuthorizeOffline.toString() == "true") {
          LocalAuthorizeOffline = 1;
        } else if (
          JSON.parse(data).LocalAuthorizeOffline.toString() == "false"
        ) {
          LocalAuthorizeOffline = 0;
        }

        var LocalPreAuthorize;
        if (JSON.parse(data).LocalPreAuthorize.toString() == "true") {
          LocalPreAuthorize = 1;
        } else if (JSON.parse(data).LocalPreAuthorize.toString() == "false") {
          LocalPreAuthorize = 0;
        }

        var MaxEnergyOnInvalidId =
          JSON.parse(data).MaxEnergyOnInvalidId.toString();
        var MeterValuesAlignedData =
          JSON.parse(data).MeterValuesAlignedData.toString();
        var MeterValuesSampledData =
          JSON.parse(data).MeterValuesSampledData.toString();
        var MeterValueSampleInterval =
          JSON.parse(data).MeterValueSampleInterval.toString();

        var MinimumStatusDuration =
          JSON.parse(data).MinimumStatusDuration.toString();
        var ResetRetries = JSON.parse(data).ResetRetries.toString();
        var ConnectorPhaseRotation =
          JSON.parse(data).ConnectorPhaseRotation.toString();

        var StopTransactionOnEVSideDisconnect;
        if (
          JSON.parse(data).StopTransactionOnEVSideDisconnect.toString() ==
          "true"
        ) {
          StopTransactionOnEVSideDisconnect = 1;
        } else if (
          JSON.parse(data).StopTransactionOnEVSideDisconnect.toString() ==
          "false"
        ) {
          StopTransactionOnEVSideDisconnect = 0;
        }

        var StopTransactionOnInvalidId;
        if (JSON.parse(data).StopTransactionOnInvalidId.toString() == "true") {
          StopTransactionOnInvalidId = 1;
        } else if (
          JSON.parse(data).StopTransactionOnInvalidId.toString() == "false"
        ) {
          StopTransactionOnInvalidId = 0;
        }

        var StopTxnAlignedData = JSON.parse(data).StopTxnAlignedData.toString();
        var TransactionMessageAttempts =
          JSON.parse(data).TransactionMessageAttempts.toString();
        var TransactionMessageRetryInterval =
          JSON.parse(data).TransactionMessageRetryInterval.toString();

        var UnlockConnectorOnEVSideDisconnect;
        if (
          JSON.parse(data).UnlockConnectorOnEVSideDisconnect.toString() ==
          "true"
        ) {
          UnlockConnectorOnEVSideDisconnect = 1;
        } else if (
          JSON.parse(data).UnlockConnectorOnEVSideDisconnect.toString() ==
          "false"
        ) {
          UnlockConnectorOnEVSideDisconnect = 0;
        }

        var WebSocketPingInterval =
          JSON.parse(data).WebSocketPingInterval.toString();
        var IdToken = JSON.parse(data).IdToken.toString();

        //sql command for update data
        mysqlstr =
          "update configcp set AllowOfflineTxForUnknownId = " +
          "'" +
          AllowOfflineTxForUnknownId +
          "'" +
          "," +
          "AuthorizationCacheEnabled = " +
          "'" +
          AuthorizationCacheEnabled +
          "'" +
          "," +
          "AuthorizeRemoteTxRequests = " +
          "'" +
          AuthorizeRemoteTxRequests +
          "'" +
          "," +
          "BlinkRepeat = " +
          "'" +
          BlinkRepeat +
          "'" +
          "," +
          "ClockAlignedDataInterval = " +
          "'" +
          ClockAlignedDataInterval +
          "'" +
          "," +
          "ConnectionTimeOut = " +
          "'" +
          ConnectionTimeOut +
          "'" +
          "," +
          "HeartbeatInterval = " +
          "'" +
          HeartbeatInterval +
          "'" +
          "," +
          "LightIntensity = " +
          "'" +
          LightIntensity +
          "'" +
          "," +
          "LocalAuthListEnabled = " +
          "'" +
          LocalAuthListEnabled +
          "'" +
          "," +
          "LocalAuthorizeOffline = " +
          "'" +
          LocalAuthorizeOffline +
          "'" +
          "," +
          "LocalPreAuthorize = " +
          "'" +
          LocalPreAuthorize +
          "'" +
          "," +
          "MaxEnergyOnInvalidId = " +
          "'" +
          MaxEnergyOnInvalidId +
          "'" +
          "," +
          "MeterValuesAlignedData = " +
          "'" +
          MeterValuesAlignedData +
          "'" +
          "," +
          "MeterValuesSampledData = " +
          "'" +
          MeterValuesSampledData +
          "'" +
          "," +
          "MeterValueSampleInterval = " +
          "'" +
          MeterValueSampleInterval +
          "'" +
          "," +
          "MinimumStatusDuration = " +
          "'" +
          MinimumStatusDuration +
          "'" +
          "," +
          "ResetRetries = " +
          "'" +
          ResetRetries +
          "'" +
          "," +
          "ConnectorPhaseRotation = " +
          "'" +
          ConnectorPhaseRotation +
          "'" +
          "," +
          "StopTransactionOnEVSideDisconnect = " +
          "'" +
          StopTransactionOnEVSideDisconnect +
          "'" +
          "," +
          "StopTransactionOnInvalidId = " +
          "'" +
          StopTransactionOnInvalidId +
          "'" +
          "," +
          "StopTxnAlignedData = " +
          "'" +
          StopTxnAlignedData +
          "'" +
          "," +
          "TransactionMessageAttempts = " +
          "'" +
          TransactionMessageAttempts +
          "'" +
          "," +
          "TransactionMessageRetryInterval = " +
          "'" +
          TransactionMessageRetryInterval +
          "'" +
          "," +
          "UnlockConnectorOnEVSideDisconnect = " +
          "'" +
          UnlockConnectorOnEVSideDisconnect +
          "'" +
          "," +
          "WebSocketPingInterval = " +
          "'" +
          WebSocketPingInterval +
          "'" +
          "," +
          "IdToken = " +
          "'" +
          IdToken +
          "'" +
          " where idconfig = 1 ";

        console.log(mysqlstr);
        dbconn.query(mysqlstr, function (err, res) {
          if (err) throw err;
          console.log("data updated!!");
        });
      });
      res.end("1 record inserted");
    }
  });
  server.listen(port, "localhost", () => {
    //webserver
    console.log(`listen to port ${port}`);
  });
}, 1000);

//Load all CP parameters on CP startup
setTimeout(() => {
  endpointurl = "";
  idcp = "";
  CBoxNum = "";
  CPModel = "";
  CPNum = "";
  CPVendor = "";
  fwVersion = "";
  iccid = "";
  imsi = "";
  meterSN = "";
  meterType = "";
  //load params from database
  mysqlstr = "select endpointurl from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    endpointurl = results[0].endpointurl;
    console.log(endpointurl);
  });
  mysqlstr = "select chargeboxid from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    idcp = results[0].chargeboxid;
    console.log(idcp);
  });
  mysqlstr = "select cboxnum from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    CBoxNum = results[0].cboxnum;
    console.log(CBoxNum);
  });
  mysqlstr = "select cpmodel from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    CPModel = results[0].cpmodel;
    console.log(CPModel);
  });
  mysqlstr = "select cpnum from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    CPNum = results[0].cpnum;
    console.log(CPNum);
  });
  mysqlstr = "select cpvendor from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    CPVendor = results[0].cpvendor;
    console.log(CPVendor);
  });
  mysqlstr = "select fwversion from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    fwVersion = results[0].fwversion;
    console.log(fwVersion);
  });
  mysqlstr = "select iccid from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    iccid = results[0].iccid;
    console.log(iccid);
  });
  mysqlstr = "select imsi from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    imsi = results[0].imsi;
    console.log(imsi);
  });
  mysqlstr = "select metersn from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    meterSN = results[0].metersn;
    console.log(meterSN);
  });
  mysqlstr = "select metertype from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    meterType = results[0].metertype;
    console.log(meterType);
  });
  mysqlstr = "select currentlimit from detailcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    currentlimit = results[0].currentlimit;
    console.log(currentlimit);
  });
  mysqlstr = "select MeterValueSampleInterval from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    intervalMeterValue = results[0].MeterValueSampleInterval;
    console.log(intervalMeterValue);
  });
  mysqlstr = "select connectorId from configcp where 1"; //load connectorId
  dbconn.query(mysqlstr, (err, results, fields) => {
    connectorId = results[0].connectorId;
    console.log("Connector Id : " + connectorId);
  });
  mysqlstr = "select cpstatus from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    cpstatus = results[0].cpstatus;
    console.log("CP Status : " + cpstatus);
  });
  mysqlstr = "select cperror from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    cperrorcode = results[0].cperror;
    console.log("CP Error : " + cperrorcode);
  });
  mysqlstr = "select IdToken from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    IdToken = results[0].IdToken;
    console.log("IdToken : " + IdToken);
  });
  mysqlstr = "select ConnectionTimeOut from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    intervaltimeout = results[0].ConnectionTimeOut;
    console.log("Connection Time Out : " + intervaltimeout);
  });
  mysqlstr = "select HeartbeatInterval from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    heartbeatinterval = results[0].HeartbeatInterval;
    console.log("HeartbeatInterval : " + heartbeatinterval);
  });
  mysqlstr = "select MeterValuesSampledData from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    // console.log(results);
    let mytemp = results[0].MeterValuesSampledData;
    measurandarray = mytemp.split(",");
    console.log(measurandarray);
  });
  mysqlstr = "select MinimumStatusDuration from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    //console.log(results);
    minimumstatusduration = results[0].MinimumStatusDuration;
    console.log("Minimum status duration : " + minimumstatusduration);
  });
  mysqlstr = "select StopTransactionOnEVSideDisconnect from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    //console.log(results);
    stoptransactiononevdisconnect =
      results[0].StopTransactionOnEVSideDisconnect;
    console.log(
      "StopTransactionOnEVDisconnect : " + stoptransactiononevdisconnect
    );
  });

  mysqlstr = "select StopTransactionOnInvalidId from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    //console.log(results);
    stoptransactiononinvalidid = results[0].StopTransactionOnInvalidId;
    //console.log("StopTransactionOnInvalidId : " + stoptransactiononinvalidid);
  });

  mysqlstr = "select AllowOfflineTxForUnknownId from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    if (err) throw err;
    allowofflinetxforunknownid = results[0].AllowOfflineTxForUnknownId;
    console.log("AllowOfflineTxForUnknownId : " + allowofflinetxforunknownid);
  });

  mysqlstr = "select AuthorizationCacheEnabled from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    authorizationcacheenabled = results[0].AuthorizationCacheEnabled;
    console.log("AuthorizationCacheEnabled : " + authorizationcacheenabled);
  });

  mysqlstr = "select LocalPreAuthorize from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    localpreauthorize = results[0].LocalPreAuthorize;
    console.log("LocalPreAuthorize : " + localpreauthorize);
  });

  mysqlstr = "select LocalAuthorizeOffline from configcp where 1";
  dbconn.query(mysqlstr, (err, results, fields) => {
    localauthorizeoffline = results[0].LocalAuthorizeOffline;
    console.log("LocalAuthorizeOffline : " + localauthorizeoffline);
  });
}, 2000);

//modbus handling for modbus relay and kwh meter
// check if any error on modbus connection
mbconn.on("error", function (error) {
  console.log("Modbus connection error: ", error);
});

connectModbus(1); //device id modbus relay is 1

// serialport.on("open", () => {
//   console.log("serial port open");
// });
// idinterval2 = setInterval(() => {
//   checkInternetConnected()
//     .then((result) => {
//       flagConnect = true;
//       console.log("Connected to internet!"); //successfully connected to a server
//       clearInterval(idinterval2);
//       setTimeout(() => {
//         client.connect(endpointurl + "" + idcp, ["ocpp1.6", "ocpp1.5"]);
//       }, 6000);
//     })
//     .catch((ex) => {
//       flagConnect = false;
//       console.log(ex); // cannot connect to a server or error occurred.
//     });
// }, 5000);

setTimeout(() => {
  //****************************************************************************************************************** */
  //create web socket client
  client = new WebSocketClient();
  //retrieve endpoint url and charge box id from database

  //client to connect
  client.connect(endpointurl + "" + idcp, ["ocpp1.6", "ocpp1.5"]);
  console.log(endpointurl + "" + idcp);

  //event connect failed
  client.on("connectFailed", function (error) {
    console.log("Connect Error: " + error.toString());
    //   //offline mode
    //   serialport.on("data", (data) => {
    //     tempstring = tempstring + String(Buffer.from(data));
    //     //console.log(tempstring);

    //     setTimeout(() => {
    //       len = tempstring.length;
    //       sliceString = tempstring.slice(0, 12);

    //       if (sliceString == "res_idtoken!") {
    //         tempIdToken = tempstring.slice(12,len-2);
    //         IdToken = tempIdToken;

    //         if (idinterval > 0) {
    //           clearInterval(idinterval);
    //         }
    //         mysqlstr = "select cpstatus from configcp where 1";
    //         dbconn.query(mysqlstr, (err, results, fields) => {
    //           cpstatus = results[0].cpstatus;
    //         });

    //         if (cpstatus == "Unavailable") {
    //           serialport.write("req_killall!");
    //         //  tempstring = "";
    //         } else if (cpstatus == "Available") {
    //           //receive idtoken(rfid tagged)

    //           setTimeout(() => {
    //             if (localauthorizeoffline || allowofflinetxforunknownid) {
    //               elementarray.length = 0; //clear array
    //               mysqlstr = "select AuthorizationCache from authorizationcache";

    //               dbconn.query(mysqlstr, (err, results) => {
    //                 if (err) {
    //                   return;
    //                 } //if fail or database already have save rfid tag value
    //                 console.log(results);
    //                 results.forEach((element) => {
    //                   elementarray.push(element.AuthorizationCache);
    //                 });
    //                 for (let k = 0; k < elementarray.length; k++) {
    //                  if (elementarray[k].localeCompare(tempIdToken) == 0) {
    //                    foundElement = true;
    //                    return;
    //                  }
    //                   foundElement = false;
    //                 }

    //               });
    //             }
    //           }, 200);
    //           setTimeout(() => {
    //             if (foundElement == true && localauthorizeoffline == true) {
    //               // console.log("start offline");
    //               serialport.write("sta_offline!"); //when rfid registered and local offlines enabled, then request for start charging
    //               //arduino check this request, when rfid status true then will start charging, otherwise will stop charging
    //             }

    //             if (
    //               foundElement == false &&
    //               localauthorizeoffline == true &&
    //               allowofflinetxforunknownid == false
    //             ) {
    //               // console.log("kill all");
    //               serialport.write("req_killall!");
    //               // console.log("No rfid tag registered.Cannot start charging!!");
    //             }
    //             if (
    //               foundElement == false &&
    //               localauthorizeoffline == true &&
    //               allowofflinetxforunknownid == true
    //             ) {
    //               // console.log("kill all");
    //               serialport.write("sta_offline!");
    //               // console.log("No rfid tag registered.Cannot start charging!!");
    //             }
    //           }, 400);
    //           tempstring = "";
    //         }
    //       }
    //       if (sliceString == "res_killall!") {
    //         tempstring = "";
    //       }
    //       if (sliceString == "res_offline!") {
    //         //receive response start charging when offline from arduino(answering sta_offline!)
    //         serialport.write("ask_mtrvalu!"); //ask for meter value
    //         tempstring = "";
    //       }
    //       if (sliceString == "ans_mtrvalu!") {
    //         //answer for meter value, display on log (can be saved in file ) or display on LCD.Not have relation with OCPP protocol
    //         let metervalue_offline = tempstring.slice(12, len - 2);
    //         //console.log(metervalue_offline);
    //         if (intervalMeterValue > 0) {

    //           idinterval = setInterval(() => {
    //             serialport.write("ref_mtrvalu!");
    //           }, intervalMeterValue * 1000);
    //         }

    //         tempstring = "";
    //       }
    //       if (sliceString == "upd_mtrvalu!") {
    //        let metervalue_offline = tempstring.slice(12, len - 2);
    //     //   console.log(metervalue_offline);
    //         let mvalue_split = metervalue_offline.split(",");
    //         let mvalue = "Voltage : "  + mvalue_split[0] + " ; " + "Current : "  + mvalue_split[1] + " ; " +  "Power : "  + mvalue_split[2] + " ; " + "PF : "  + mvalue_split[3] + " ; " +  "Freq : "  + mvalue_split[4] + " ; " +  "kWh : "  + mvalue_split[5] + " ; " +  "Plug status : " +  mvalue_split[6]   ;
    //         console.log(mvalue);

    //          writeLog("logocpp.txt", "INFO[" + new Date() + "]" + mvalue + "\n");
    //           tempstring = "";
    //           mvalue_split.length=0;
    //           metervalue_offline="";
    //           mvalue="";

    //       }
    //       if (sliceString == "sto_offline!") {
    //         console.log("stop offline");
    //         if (idinterval != 0) {
    //           clearInterval(idinterval);
    //         }
    //         tempstring = "";
    //       }
    //     }, 2000);
    //   });
  });

  //event connect
  client.on("connect", function (connection) {
    console.log("WebSocket Client Connected");
    //   //**************************************************************************/
    //   //Receive serial data from arduino

    //   serialport.on("data", (data) => {
    //     tempstring = tempstring + String(Buffer.from(data));
    //     savetempstring = tempstring;

    //     setTimeout(() => {
    //       len = tempstring.length;
    //       sliceString = tempstring.slice(0, 12);
    //       if (sliceString == "res_idtoken!") {
    //         if (idinterval > 0) {
    //           clearInterval(idinterval);
    //         }
    //         mysqlstr = "select cpstatus from configcp where 1";
    //         dbconn.query(mysqlstr, (err, results, fields) => {
    //           cpstatus = results[0].cpstatus;
    //           //console.log(cpstatus);
    //         });
    //         if (cpstatus == "Unavailable") {
    //           serialport.write("req_killall!");
    //         } else {
    //           //receive IDToken adn save for last tag id token
    //           tempIdToken = tempstring.slice(12, len - 2);
    //           //tempIdToken = tempstring.slice(12, 20);
    //           IdToken=tempIdToken;
    //           console.log(tempIdToken);
    //           setTimeout(() => {
    //             mysqlstr =
    //               "update configcp set LastTagIdToken = " +
    //               "'" +
    //               tempIdToken +
    //               "'" +
    //               " where idconfig = 1";

    //             dbconn.query(mysqlstr, function (err, res) {
    //               if (err) throw err;
    //               console.log("Last Tag Id Token Saved!!");
    //             });
    //           }, 200);

    //           //check AuthorizationCacheEnabled status
    //           setTimeout(() => {
    //             if (authorizationcacheenabled == 1) {
    //               //if enabled, then save any rfid tag into AuthorizationCache database
    //               mysqlstr =
    //                 "insert into authorizationcache(AuthorizationCache) values(?)";
    //               var values = [tempIdToken];
    //               dbconn.query(mysqlstr, values, (err, results) => {
    //                 if (err) {
    //                   return;
    //                 } //if fail or database already have save rfid tag value
    //                 console.log("Authorization cache added !");
    //               });
    //             }
    //           }, 400);
    //           //check LocalPreAuthorize status
    //           setTimeout(() => {
    //             if (localpreauthorize == 1) {
    //               //if enabled, match tagged rfid card with AuthorizationCache database content
    //               elementarray.length = 0;
    //               mysqlstr = "select AuthorizationCache from authorizationcache";
    //               dbconn.query(mysqlstr, (err, results) => {
    //                 if (err) {
    //                   return;
    //                 } //if fail or database already have save rfid tag value
    //                 // console.log(results);
    //                 results.forEach((element) => {
    //                   elementarray.push(element.AuthorizationCache);
    //                 });
    //                 console.log(elementarray);
    //                 if (elementarray.includes(tempIdToken)) {
    //                   foundElement = true;
    //                 }
    //               });
    //             }
    //           }, 600);

    //           //determine charging refer to rfidtoken and other configuration set before
    //           setTimeout(() => {
    //             if (foundElement && localpreauthorize) {
    //               serialport.write("req_plugsta!");
    //             }
    //           }, 800);

    //           tempstring = "";
    //         }
    //       }

    //       if (sliceString == "res_plugsta!") {
    //         //receive plug status\
    //         plugstatusstr = tempstring.slice(12, len - 2);
    //         console.log("Plug status : " + plugstatusstr);
    //         if (plugstatusstr == "plugOn") {
    //           setTimeout(() => {
    //             serialport.write("req_rfidsta!");
    //           }, 300);
    //         }

    //         tempstring = "";
    //       }

    //       if (sliceString == "res_rfidsta!") {
    //         //receive RFID status
    //         rfidTranscStatus = tempstring.slice(12, len - 2);
    //         console.log("RFID Transc.Status : " + rfidTranscStatus);
    //         setTimeout(() => {
    //           serialport.write("req_mstaval!");
    //         }, 300);
    //         tempstring = "";
    //       }

    //       if (sliceString == "res_mstaval!") {
    //         //receive meter start value
    //         meterkwhvaluestr = tempstring.slice(12, len - 2);
    //         metervaluearray = meterkwhvaluestr.split(",");
    //         console.log("Meter start value: " + metervaluearray[5]);

    //         setTimeout(() => {
    //           AuthorizeReq(connection, IdToken);
    //         }, 300);

    //         tempstring = "";
    //       }
    //       if (sliceString == "res_mtrvrem!") {
    //         //receive meter value remote
    //         //CP Response for metervalue used in RemoteStartTransaction
    //         meterkwhvaluestr = tempstring.slice(12, len - 2);
    //         metervaluearray = meterkwhvaluestr.split(",");
    //         if (!flagRemoteStartBegin) {
    //           flagRemoteStartBegin = true;
    //           flagRemoteStopBegin = false;

    //           setTimeout(() => {
    //             meterkwhvalue = parseFloat(metervaluearray[5]);
    //             StartTransactionReq(
    //               connection,
    //               connectorId,
    //               IdToken,
    //               meterkwhvalue
    //             );
    //           }, 1000);
    //         }
    //         tempstring = "";
    //       }
    //       if (sliceString == "res_mtrsrem!") {
    //         //Recevie meter value for RemoteStop transaction
    //         //CP Response for metervalue used in RemoteStopTransaction
    //         meterkwhvaluestr = tempstring.slice(12, len - 2);
    //         metervaluearray = meterkwhvaluestr.split(",");
    //         if (!flagRemoteStop) {
    //           flagRemoteStop = true;
    //           flagRemoteStart = false;

    //           setTimeout(() => {
    //             RemoteStopTransaction(connection,"Accepted");
    //           }, 200);
    //         }
    //         if (!flagRemoteStopBegin) {
    //           flagRemoteStartBegin = false;
    //           flagRemoteStopBegin = true;
    //           setTimeout(() => {
    //             meterkwhvalue = parseFloat(metervaluearray[5]);
    //             console.log("trans id  : " + transId);
    //             setTimeout(() => {
    //               let reason = "Remote";
    //               StopTransactionReq(connection, transId, meterkwhvalue, reason);
    //             }, 600);
    //           }, 200);
    //         }
    //         tempstring = "";
    //       }

    //       if (sliceString == "res_opravai!") {
    //         cpstatus = tempstring.slice(12, len - 2);
    //         mysqlstr =
    //           "update configcp set cpstatus = " +
    //           "'" +
    //           cpstatus +
    //           "'" +
    //           " where idconfig = 1";

    //         dbconn.query(mysqlstr, function (err, res) {
    //           if (err) throw err;
    //           console.log("ChargerAviability updated!!");
    //         });

    //         setTimeout(() => {
    //           ChangeAvailability(connection, "Accepted");
    //         }, 400);
    //         tempstring = "";
    //       }

    //       if (sliceString == "res_ioprava!") {
    //         cpstatus = tempstring.slice(12, len - 2);
    //         mysqlstr =
    //           "update configcp set cpstatus = " +
    //           "'" +
    //           cpstatus +
    //           "'" +
    //           " where idconfig = 1";

    //         dbconn.query(mysqlstr, function (err, res) {
    //           if (err) throw err;
    //           console.log("ChargerAviability updated!!");
    //         });

    //         setTimeout(() => {
    //           ChangeAvailability(connection, "Accepted");
    //         }, 400);
    //         tempstring = "";
    //       }

    //       if (sliceString == "res_cutchrg!") {
    //         let matchStatus = tempstring.slice(12, len - 2);

    //         tempstring = "";
    //       }

    //       if (sliceString == "upd_mtrvalu!") {
    //         //update metervalue
    //         refreshmetervalue = savetempstring.slice(12, len - 2);
    //         refreshmetervaluearray = refreshmetervalue.split(",");
    //         //  console.log(refreshmetervaluearray[6]);
    //         if (
    //           stoptransactiononevdisconnect == true &&
    //           refreshmetervaluearray[6] == "plugOff"
    //         ) {
    //           let reason = "EVDisconnected";
    //           meterkwhvalue = parseFloat(refreshmetervaluearray[5]);
    //           StopTransactionReq(connection, transId, meterkwhvalue, reason);
    //           serialport.write("req_cutchrg!");
    //           return;
    //         }

    //         MeterValuesReq(
    //           connection,
    //           connectorId,
    //           transId,
    //           measurandarray,
    //           refreshmetervaluearray
    //         );

    //         tempstring = "";
    //         meterkwhvaluestr = "";
    //         metervaluearray.length = 0; //clear array
    //       }

    //       if (sliceString == "res_unlockd!") {
    //         setTimeout(() => {
    //           UnlockConnector(connection);
    //         }, 200);
    //         tempstring = "";
    //       }
    //     }, 2000);
    //   });

    //*************************************** */
    //CP BOOTING
    setTimeout(() => {
      ColdBootChargePoint(connection); //send params of selected CP
    }, 3000);

    //event connection error
    connection.on("error", function (error) {
      //when connection error rise
      console.log("Connection Error: " + error.toString());
    });
    //event connection close
    connection.on("close", function () {
      //when connection close
      console.log("Websocket Connection Closed");
    });

    //event received a message
    connection.on("message", function (message) {
      //when received message in connection
      if (message.type === "utf8") {
        console.log("Receive : '" + message.utf8Data + "'");
        var received_msg = message.utf8Data;

        //   writeLog("logocpp.txt", "INFO[" + new Date() + "]" + received_msg + "\n");

        objmsg = JSON.parse(received_msg);
        //  console.log(objmsg);
        switch (objmsg[0]) {
          case 2:
            check_CS_req(connection);
            break;
          case 3:
            check_msg(connection);
            break;
          default:
            break;
        }
      }
    });
  });
}, 6000);

//FUNCTION FOR CP PROVISION
function ColdBootChargePoint(connection) {
  BootNotificationReq(
    connection,
    CPVendor,
    CPModel,
    CPNum,
    CBoxNum,
    fwVersion,
    iccid,
    imsi,
    meterType,
    meterSN
  );
}

function randonId() {
  id = "";
  for (var i = 0; i < 36; i++) {
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return id;
}
//**************************************************************************************************************** */
//MODBUS ROUTINES HANDLING
//************************************************************************************************************** */

function convertNumber(num) {
  if (num > 32768) {
    resnum = 65536 - num;
  } else {
    resnum = num;
  }
  return resnum;
}

function connectModbus(mbsId) {
  mbconn.setID(mbsId);
  mbconn.setTimeout(mbsTimeout);
  // try to connect
  mbconn
    .connectRTUBuffered(`${portRTU}`, {
      baudRate: 9600,
      parity: "none",
      dataBits: 8,
      stopBits: 1,
    })
    .then(function () {
      mbsState = MBS_STATE_GOOD_CONNECT;
      mbsStatus = "Connected, wait for writing...";
      console.log(mbsStatus);
      allRelayOff();
    })
    .catch(function (e) {
      mbsState = MBS_STATE_FAIL_CONNECT;
      mbsStatus = e.message;
      console.log(e);
    });
}

function turnRelayOn(address) {
  mbconn.setID(1);
  mbconn.writeCoil(address, 0xff00);
}
function turnRelayOff(address) {
  mbconn.setID(1);
  mbconn.writeCoil(address, 0x0000);
}
function allRelayOff() {
  mbconn.setID(1);

  for (let j = 0; j < 8; j++) {
    setTimeout(() => {
      turnRelayOff(j);
    }, 2000 * j);
  }
}

function allRelayOn() {
  mbconn.setID(1);

  for (let j = 0; j < 8; j++) {
    setTimeout(() => {
      turnRelayOn(j);
    }, 2000 * j);
  }
}

// //********************************************************************************************************* */
// //BLOCK FUNCTION - BEGIN - Note :function send req from CP to CS
// //****************************************************************************************************88 */
function AuthorizeReq(connection, IdToken) {
  //Authorize.req
  sessionstorage.setItem("LastAction", "Authorize"); //session : "Authorize"
  var Auth = JSON.stringify([2, id, "Authorize", { idTag: IdToken }]);
  console.log(Auth);
  connection.send(Auth);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + Auth + "\n");
}
function BootNotificationReq(
  connection,
  cpvendor,
  cpmodel,
  cpsn,
  cboxsn,
  fwver,
  iccid,
  imsi,
  metertype,
  metersn
) {
  //Bootnofication.req
  sessionstorage.setItem("LastAction", "BootNotification");
  var BN = JSON.stringify([
    2,
    id,
    "BootNotification",
    {
      chargePointVendor: cpvendor,
      chargePointModel: cpmodel,
      chargePointSerialNumber: cpsn,
      chargeBoxSerialNumber: cboxsn,
      firmwareVersion: fwver,
      iccid: iccid,
      imsi: imsi,
      meterType: metertype,
      meterSerialNumber: metersn,
    },
  ]);
  console.log(BN);
  connection.send(BN);
  //writeLog("logocpp.txt", "INFO[" + new Date() + "]" + BN + "\n");
}
function HeartbeatReq(connection) {
  //Heartbeat.req
  sessionstorage.setItem("LastAction", "Heartbeat"); //session : "Heartbeat"
  var HB = JSON.stringify([2, id, "Heartbeat", {}]);
  connection.send(HB);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + HB + "\n");
}
function StartTransactionReq(connection, connectorId, IdToken, meterkwhvalue) {
  //start transaction
  sessionstorage.setItem("LastAction", "startTransaction"); //session = "startTransaction";
  var strtT = JSON.stringify([
    2,
    id,
    "StartTransaction",
    {
      connectorId: connectorId,
      idTag: IdToken,
      meterStart: meterkwhvalue,
      timestamp: new Date(),
    },
  ]);
  console.log(strtT);
  connection.send(strtT);
  //writeLog("logocpp.txt", "INFO[" + new Date() + "]" + strtT + "\n");
}
// function MeterValuesReq(
//   connection,
//   connectorId,
//   transId,
//   strvalue,
//   formatvalue,
//   measurandvalue,
//   context,
//   phase,
//   unit
// ) {
//   //check measurand value passed
//   //meter values
//   sessionstorage.setItem("LastAction", "MeterValues"); //"MeterValues"
//   var mv = JSON.stringify([
//     2,
//     id,
//     "MeterValues",
//     {
//       connectorId: connectorId,
//       transactionId: transId,
//       meterValue: [
//         {
//           timestamp: new Date(),
//           sampledValue: [
//             {
//               value: strvalue,
//               format: formatvalue,
//               measurand: measurandvalue,
//               context: context,
//               phase: phase,
//               unit: unit,
//             },
//           ],
//         },
//       ],
//     },
//   ]);
//   console.log(mv);
//   connection.send(mv);
// }

function MeterValuesReq(
  connection,
  connectorId,
  transId,
  measurandarray,
  metervaluearray
) {
  //check measurand value passed
  //meter values
  sessionstorage.setItem("LastAction", "MeterValues"); //"MeterValues"
  let arrobjsamplevalue = [];
  let obj;
  for (let j = 0; j < measurandarray.length; j++) {
    if (measurandarray[j] == "Voltage") {
      metervoltage = parseFloat(metervaluearray[0]);
      obj = {
        value: metervoltage,
        format: "Raw",
        measurand: "Voltage",
        context: "Sample.Periodic",
        phase: "L1",
        unit: "V",
      };
      arrobjsamplevalue.push(obj);
    }
    if (measurandarray[j] == "Current.Import") {
      metercurrent = parseFloat(metervaluearray[1]);
      obj = {
        value: metercurrent,
        format: "Raw",
        measurand: "Current.Import",
        context: "Sample.Periodic",
        phase: "L1",
        unit: "A",
      };
      arrobjsamplevalue.push(obj);
    }
    if (measurandarray[j] == "Power.Active.Import") {
      meterpower = parseFloat(metervaluearray[2]);
      obj = {
        value: meterpower,
        format: "Raw",
        measurand: "Power.Active.Import",
        context: "Sample.Periodic",
        phase: "L1",
        unit: "kW",
      };
      arrobjsamplevalue.push(obj);
    }
    if (measurandarray[j] == "Power.Factor") {
      meterpf = parseFloat(metervaluearray[3]);
      obj = {
        value: meterpf,
        format: "Raw",
        measurand: "Power.Factor",
        context: "Sample.Periodic",
        phase: "L1",
      };
      arrobjsamplevalue.push(obj);
    }
    if (measurandarray[j] == "Frequency") {
      meterfreq = parseFloat(metervaluearray[4]);
      obj = {
        value: meterfreq,
        format: "Raw",
        measurand: "Frequency",
        context: "Sample.Periodic",
        phase: "L1",
      };
      arrobjsamplevalue.push(obj);
    }
    if (measurandarray[j] == "Energy.Active.Import.Register") {
      meterkwhvalue = parseFloat(metervaluearray[5]);
      obj = {
        value: meterkwhvalue,
        format: "Raw",
        measurand: "Energy.Active.Import.Register",
        context: "Sample.Periodic",
        phase: "L1",
        unit: "kWh",
      };
      arrobjsamplevalue.push(obj);
    }
  }
  var mv = JSON.stringify([
    2,
    id,
    "MeterValues",
    {
      connectorId: connectorId,
      transactionId: transId,
      meterValue: [
        {
          timestamp: new Date(),
          sampledValue: arrobjsamplevalue,
        },
      ],
    },
  ]);
  console.log(mv);
  connection.send(mv);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + mv + "\n");
  metervaluearray.length = 0; //empty array
}
function StopTransactionReq(connection, transId, meterkwhvalue, reason) {
  //stop transaction
  sessionstorage.setItem("LastAction", "stopTransaction"); //"stopTransaction";
  var stpT = JSON.stringify([
    2,
    id,
    "StopTransaction",
    {
      transactionId: transId,
      timestamp: new Date(),
      meterStop: meterkwhvalue,
      reason: reason,
    },
  ]);
  console.log(stpT);
  connection.send(stpT);
  //writeLog("logocpp.txt", "INFO[" + new Date() + "]" + stpT + "\n");
}
function DiagnosticsStatusNotificationReq(connection, status) {
  //DiagnosticsStatusNotification
  sessionstorage.setItem("LastAction", "diagnosticsStatusNotification"); //"diagnosticsStatusNotification"
  var dsn = JSON.stringify([
    2,
    id,
    "DiagnosticsStatusNotification",
    {
      status: status,
    },
  ]);
  console.log(dsn);
  connection.send(dsn);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + dsn + "\n");
}
function FirmwareStatusNotificationReq(connection, status) {
  //FirmwareStatusNotification
  sessionstorage.setItem("LastAction", "firmwareStatusNotification"); //"firmwareStatusNotification"
  var fsn = JSON.stringify([
    2,
    id,
    "FirmwareStatusNotification",
    {
      status: status,
    },
  ]);
  console.log(fsn);
  connection.send(fsn);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + fsn + "\n");
}
function StatusNotificationReq(connection, connectorId, errorCode, status) {
  minimumstatusduration = parseInt(minimumstatusduration);
  setTimeout(() => {
    //delay certain time as set in MinimumStatusDuration, before StatusNotification
    //StatusNotification
    sessionstorage.setItem("LastAction", "StatusNotification");
    var sn = JSON.stringify([
      2,
      id,
      "StatusNotification",
      {
        connectorId: connectorId,
        errorCode: errorCode,
        status: status,
      },
    ]);
    console.log(sn);
    connection.send(sn);
    // writeLog("logocpp.txt", "INFO[" + new Date() + "]" + sn + "\n");
  }, minimumstatusduration * 1000);
}

//********************************************************************************************** */
//BLOCK FUNCTION - END - Note :function send req from CP to CS
//************************************************************************************************ */
//***************************************************************************************************** */
//        Functions to response json command sent from CS to CP - BEGIN
//************************************************************************************************************ */
function CancelReservation(connection, status) {
  sessionstorage.setItem("LastAction", "cancelReservation");
  var cr = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(cr);
  connection.send(cr);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + cr + "\n");
}
function ChangeAvailability(connection, status) {
  sessionstorage.setItem("LastAction", "changeAvailability");
  var ca = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(ca);
  connection.send(ca);
  //  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + ca + "\n");
}
function ChangeConfiguration(connection, status) {
  sessionstorage.setItem("LastAction", "changeConfiguration");
  var cc = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(cc);
  connection.send(cc);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + cc + "\n");
}
function ClearCache(connection, status) {
  sessionstorage.setItem("LastAction", "clearCache");
  var ccache = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  //document.getElementById("display1").innerText = "From CP to CS : " + ccache;
  console.log(ccache);
  connection.send(ccache);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + ccache + "\n");
}
function GetDiagnostics(connection, filename) {
  sessionstorage.setItem("LastAction", "getDiagnostics");
  var gd = JSON.stringify([
    3,
    objmsg[1],
    {
      fileName: filename,
    },
  ]);
  console.log(gd);
  connection.send(gd);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + gd + "\n");
}
function UpdateFirmware(connection) {
  sessionstorage.setItem("LastAction", "UpdateFirmware");
  var ufw = JSON.stringify([3, objmsg[1], {}]);
  console.log(ufw);
  connection.send(ufw);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + ufw + "\n");
}
function ReserveNow(connection, status) {
  sessionstorage.setItem("LastAction", "ReserveNow");
  var rnow = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(rnow);
  connection.send(rnow);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + rnow + "\n");
}

function RemoteStartTransaction(connection, status) {
  sessionstorage.setItem("LastAction", "remoteStartTransaction");
  var remotestart = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(remotestart);
  connection.send(remotestart);
  //writeLog("logocpp.txt", "INFO[" + new Date() + "]" + remotestart + "\n");
}
function RemoteStopTransaction(connection, status) {
  sessionstorage.setItem("LastAction", "remoteStopTransaction");
  var remotestop = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(remotestop);
  connection.send(remotestop);
  // writeLog("logocpp.txt", "INFO[" + new Date() + "]" + remotestop + "\n");
}
function Reset(connection) {
  sessionstorage.setItem("LastAction", "reset");
  var reset = JSON.stringify([
    3,
    objmsg[1],
    {
      status: "Accepted",
    },
  ]);
  console.log(reset);
  connection.send(reset);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + reset + "\n");
}
function UnlockConnector(connection) {
  sessionstorage.setItem("LastAction", "unlockConnector");
  var unlock = JSON.stringify([
    3,
    objmsg[1],
    {
      status: "NotSupported",
    },
  ]);
  console.log(unlock);
  connection.send(unlock);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + unlock + "\n");
}
function DataTransfer(connection, status) {
  sessionstorage.setItem("LastAction", "DataTransfer");
  var datatransfer = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(datatransfer);
  connection.send(datatransfer);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + datatransfer + "\n");
}
function GetConfiguration(connection, key, readonly, value) {
  sessionstorage.setItem("LastAction", "GetConfiguration");
  var getconfig = JSON.stringify([
    3,
    objmsg[1],
    {
      configurationKey: [
        {
          key: key,
          readonly: readonly,
          value: value,
        },
      ],
    },
  ]);
  console.log(getconfig);
  connection.send(getconfig);
  // writeLog("logocpp.txt", "INFO[" + new Date() + "]" + getconfig + "\n");
}
function GetLocalListVersion(connection, version) {
  sessionstorage.setItem("LastAction", "GetLocalListVersion");
  var localListVersion = JSON.stringify([
    3,
    objmsg[1],
    {
      listVersion: version,
    },
  ]);
  console.log(localListVersion);
  connection.send(localListVersion);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + localListVersion + "\n");
}
function SendLocalList(connection, status) {
  sessionstorage.setItem("LastAction", "SendLocalList");
  var sendLocalList = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(sendLocalList);
  connection.send(sendLocalList);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + sendLocalList + "\n");
}

function TriggerMessage(connection, status) {
  sessionstorage.setItem("LastAction", "TriggerMessage");
  var triggerMessage = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(triggerMessage);
  connection.send(triggerMessage);
  writeLog("logocpp.txt", "INFO[" + new Date() + "]" + triggerMessage + "\n");
}
function GetCompositeSchedule(connection, status) {
  sessionstorage.setItem("LastAction", "GetCompositeSchedule");
  var getCompositeSchedule = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(getCompositeSchedule);
  connection.send(getCompositeSchedule);
  writeLog(
    "logocpp.txt",
    "INFO[" + new Date() + "]" + getCompositeSchedule + "\n"
  );
}
function ClearChargingProfile(connection, status) {
  sessionstorage.setItem("LastAction", "ClearChargingProfile");
  var clearChargingProfile = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(clearChargingProfile);
  connection.send(clearChargingProfile);
  writeLog(
    "logocpp.txt",
    "INFO[" + new Date() + "]" + clearChargingProfile + "\n"
  );
}
function SetChargingProfile(connection, status) {
  sessionstorage.setItem("LastAction", "SetChargingProfile");
  var setChargingProfile = JSON.stringify([
    3,
    objmsg[1],
    {
      status: status,
    },
  ]);
  console.log(setChargingProfile);
  connection.send(setChargingProfile);
  writeLog(
    "logocpp.txt",
    "INFO[" + new Date() + "]" + setChargingProfile + "\n"
  );
}
//***************************************************************************************************** */
//        Functions to response json command sent from CS to CP - END
//************************************************************************************************************ */

//***************************************************************** */
//CS send req , CP send conf
//check for received req from CS

function check_CS_req(connection) {
  //cancel reservation
  if (objmsg[2] == "CancelReservation") {
    CancelReservation(connection, "Rejected"); //Accepted,Rejected
  }
  //change availability
  if (objmsg[2] == "ChangeAvailability") {
    connectorId = objmsg[3].connectorId; //get requested connectorId
    var reqops = objmsg[3].type;
    console.log(connectorId);
    console.log(reqops);

    setTimeout(() => {
      mysqlstr =
        "update connector set status = " +
        "'" +
        reqops +
        "'" +
        " where connector = " +
        "'" +
        connectorId +
        "'";

      dbconn.query(mysqlstr, function (err, res) {
        if (err) throw err;

        console.log("Status connector updated!!");
      });
    }, 200);
    setTimeout(() => {
      ChangeAvailability(connection, "Accepted");
    }, 500);
  }
  //change configuration
  if (objmsg[2] == "ChangeConfiguration") {
    readKeyConfig = objmsg[3].key;
    readValueConfig = objmsg[3].value;

    for (j = 0; j < CPConfiguration.length; j++) {
      if (readKeyConfig == CPConfiguration[j].key) {
        if (CPConfiguration[j].value == "Accepted") {
          //update database
          mysqlstr =
            "update configcp set " +
            readKeyConfig +
            " = " +
            readValueConfig +
            " where idconfig = 1";
          //console.log("sql : " + mysqlstr);
          dbconn.query(mysqlstr, function (err, res) {
            if (err) {
              setTimeout(() => {
                ChangeConfiguration(connection, "Rejected");
              }, 500);
            }
            //   console.log("ChargerConfiguration updated!!");
          });

          setTimeout(() => {
            ChangeConfiguration(connection, "Accepted");
          }, 500);
        } else if (CPConfiguration[j].value == "NotSupported") {
          setTimeout(() => {
            ChangeConfiguration(connection, "NotSupported");
          }, 500);
        }
      }
    }
  }

  //clear cache
  if (objmsg[2] == "ClearCache") {
    setTimeout(() => {
      mysqlstr = "delete from authorizationcache where 1";
      dbconn.query(mysqlstr, (err, results, fields) => {
        //  res.end(JSON.stringify(results)); //send response
      });
    }, 100);
    setTimeout(() => {
      ClearCache(connection, "Accepted"); //Accepted, Rejected
    }, 300);
  }
  //get diagnostics
  if (objmsg[2] == "GetDiagnostics") {
    ftplocation = objmsg[3].location;
    console.log(ftplocation);
    setTimeout(() => {
      mysqlstr =
        "update configcp set FTPAddress = " +
        "'" +
        ftplocation +
        "'" +
        " where idconfig = 1";

      dbconn.query(mysqlstr, function (err, res) {
        if (err) {
          console.log("error save ftp address");
        } else {
          console.log("GetDiagnostics updated!!");
          let resultSplitString = ftplocation.split(/[/:@]/);
          console.log(resultSplitString);
          console.log("Host : " + resultSplitString[5]);
          console.log("User : " + resultSplitString[3]);
          console.log("Password : " + resultSplitString[4]);
          console.log("Port : " + resultSplitString[6]);
          console.log("Path : " + resultSplitString[7]);
          let diagnosticFile = "logocpp.txt";
          let remotePath;
          remotePath = "/" + resultSplitString[7] + "/" + diagnosticFile;

          setTimeout(() => {
            uploadFileToFTP(
              diagnosticFile,
              remotePath,
              resultSplitString[5],
              resultSplitString[3],
              resultSplitString[4],
              resultSplitString[6]
            );
          }, 500);

          GetDiagnostics(connection, "logocpp.txt"); //name of diagnostic file
          DiagnosticsStatusNotificationReq(connection, "Uploaded");
        }
      });
    }, 500);
  }
  //update firmware
  if (objmsg[2] == "UpdateFirmware") {
    ftplocation = objmsg[3].location;
    console.log(ftplocation);
    setTimeout(() => {
      mysqlstr =
        "update configcp set FTPFirmware = " +
        "'" +
        ftplocation +
        "'" +
        " where idconfig = 1";

      dbconn.query(mysqlstr, function (err, res) {
        if (err) {
          console.log("error save ftp firmware address");
        } else {
          console.log("UpdateFirmware updated!!");
          let resultSplitString = ftplocation.split(/[/:@]/);
          console.log(resultSplitString);
          console.log("Host : " + resultSplitString[5]);
          console.log("User : " + resultSplitString[3]);
          console.log("Password : " + resultSplitString[4]);
          console.log("Port : " + resultSplitString[6]);
          console.log("Path : " + resultSplitString[7]);
          let firmwareFile = "firmware.txt";
          let remotePath;
          remotePath = "/" + resultSplitString[7] + "/" + firmwareFile;

          setTimeout(() => {
            uploadFileToFTP(
              firmwareFile,
              remotePath,
              resultSplitString[5],
              resultSplitString[3],
              resultSplitString[4],
              resultSplitString[6]
            );
          }, 500);

          UpdateFirmware(connection); //no field
          FirmwareStatusNotificationReq(connection, "Downloaded");
        }
      });
    }, 500);
  }
  //ReserveNow
  if (objmsg[2] == "ReserveNow") {
    ReserveNow(connection, "Rejected"); //Accepted,Rejected,Faulted,Occupied,Unavailable
  }
  //GetConfiguration
  if (objmsg[2] == "GetConfiguration") {
    var key = objmsg[3].key[0];
    var readonly;
    var value;
    var j;
    for (j = 0; j < CPConfiguration.length; j++) {
      if (CPConfiguration[j].key == key) {
        if (CPConfiguration[j].value == "Accepted") {
          readonly = false;
        } else {
          readonly = true;
        }
      }
    }
    mysqlstr = "select " + key + " from configcp where 1";
    dbconn.query(mysqlstr, (err, results, fields) => {
      value = results[0][key];
      //  console.log(value);
      GetConfiguration(connection, key, readonly, value);
    });
  }
  //remote start transaction
  if (objmsg[2] == "RemoteStartTransaction") {
    connectorId = objmsg[3].connectorId; //get requested connectorId

    //if (!flagRemoteStart) {
    //  console.log("Id Token Remote Transc. : " + IdToken);
    mysqlstr = "select status from connector where connector = " + connectorId;
    dbconn.query(mysqlstr, (err, results, fields) => {
      connectorstatus = results[0].status;
      if (connectorstatus == "Operative") {
        // flagRemoteStart = true;
        // flagRemoteStop = false;
        console.log("connector status : " + connectorstatus);

        console.log("connector id yg mau diaktifkan : " + connectorId);

        setTimeout(() => {
          turnRelayOn(connectorId);
          switchposition="Open";
          mysqlstr =
            "update connector set switchpos = " + "'" + switchposition + "'" +
            " where connector = " +
            "'" +
            connectorId +
            "'";

          dbconn.query(mysqlstr, function (err, res) {
            if (err) throw err;
            console.log("Relay position  updated!!");
          });
        }, 100);

        setTimeout(() => {
          RemoteStartTransaction(connection, "Accepted"); //send RemoteStartTransaction.conf from CP
        }, 1000);
        //         if (!flagRemoteStartBegin) {
        //           flagRemoteStartBegin = true;
        //           flagRemoteStopBegin = false;

        setTimeout(() => {
          // meterkwhvalue = parseFloat(metervaluearray[5]);
          mbconn.setID(7);
          mbconn.setTimeout(mbsTimeout);
          let addrmb;
          if (connectorId == 1) {
            addrmb = 0x0352;
          } else if (connectorId == 2) {
            addrmb = 0x0354;
          } else if (connectorId == 3) {
            addrmb = 0x0356;
          }
          // else if(connectorId==4){addrmb=0x0356;}
          // else if(connectorId==5){addrmb=0x0356;}
          // else if(connectorId==6){addrmb=0x0356;}

          setTimeout(() => {
            mbconn
              .readHoldingRegisters(addrmb, 4) //active energy
              .then(function (data) {
                let tempnum =
                  data.data[0] + data.data[1] + data.data[2] + data.data[3];
                meterkwhvalue = (convertNumber(tempnum) * ctratio) / 100;
              })
              .catch(function (e) {
                console.log(e);
              });
          }, 1000);
        }, 2000);
        setTimeout(() => {
          StartTransactionReq(connection, connectorId, IdToken, meterkwhvalue);
        }, 5000);
      } else if (connectorstatus == "Inoperative") {
        console.log("connector status : " + connectorstatus);

        setTimeout(() => {
          RemoteStartTransaction(connection, "Rejected"); //send RemoteStartTransaction.conf from CP
          turnRelayOff(connectorId);
          switchposition="Close";
          mysqlstr =
            "update connector set switchpos = " + "'" + switchposition + "'" +
            " where connector = " +
            "'" +
            connectorId +
            "'";

          dbconn.query(mysqlstr, function (err, res) {
            if (err) throw err;
            console.log("Relay position  updated!!");
          });
        }, 1000);
      }
      //   }
    });
  }
  //remote stop transaction
  if (objmsg[2] == "RemoteStopTransaction") {
    transId = objmsg[3].transactionId;
    console.log("trans id  : " + transId);

    for (let k = 0; k < currentTx.length; k++) {
      if (currentTx[k].txid == transId) {
        connectorId = currentTx[k].id; //update connector id need to stop
        //    console.log("connector id need to stop : " + connectorId);
      }
    }

    mysqlstr = "select status from connector where connector = " + connectorId;
    dbconn.query(mysqlstr, (err, results, fields) => {
      connectorstatus = results[0].status;
      if (connectorstatus == "Operative") {
        setTimeout(() => {
          turnRelayOff(connectorId);
          switchposition="Close";
          mysqlstr =
            "update connector set switchpos = " + "'" + switchposition + "'" +
            " where connector = " +
            "'" +
            connectorId +
            "'";

          dbconn.query(mysqlstr, function (err, res) {
            if (err) throw err;
            console.log("Relay position  updated!!");
          });
        }, 100);
        setTimeout(() => {
          RemoteStopTransaction(connection, "Accepted");
        }, 1000);
        setTimeout(() => {
          mbconn.setID(7);
          mbconn.setTimeout(mbsTimeout);
          let addrmb;
          if (connectorId == 1) {
            addrmb = 0x0352;
          } else if (connectorId == 2) {
            addrmb = 0x0354;
          } else if (connectorId == 3) {
            addrmb = 0x0356;
          }
          // else if(connectorId==4){addrmb=0x0356;}
          // else if(connectorId==5){addrmb=0x0356;}
          // else if(connectorId==6){addrmb=0x0356;}

          setTimeout(() => {
            mbconn
              .readHoldingRegisters(addrmb, 4) //active energy
              .then(function (data) {
                let tempnum =
                  data.data[0] + data.data[1] + data.data[2] + data.data[3];
                meterkwhvalue = (convertNumber(tempnum) * ctratio) / 100;
              })
              .catch(function (e) {
                console.log(e);
              });
          }, 1000);
        }, 2000);

        setTimeout(() => {
          let reason = "Remote";
          StopTransactionReq(connection, transId, meterkwhvalue, reason);
          currentTx[connectorId - 1].txid = 0; //reset trans id to 0, for stopped connector id
        }, 4000);
      } else if (connectorstatus == "Inoperative") {
        setTimeout(() => {
          RemoteStopTransaction(connection, "Rejected"); //send RemoteStartTransaction.conf from CP
          turnRelayOff(connectorId);
          switchposition="Close";
          mysqlstr =
            "update connector set switchpos = " + "'" + switchposition + "'" +
            " where connector = " +
            "'" +
            connectorId +
            "'";

          dbconn.query(mysqlstr, function (err, res) {
            if (err) throw err;
            console.log("Relay position  updated!!");
          });
        }, 1000);
      }
    });
  }
  //reset
  if (objmsg[2] == "Reset") {
    //Reset();
    Reset(connection);
    setTimeout(() => {
      if (connection) {
        connection.close(); //disconnect
      }
    }, 500);
    setTimeout(() => {
      client.connect(endpointurl + "" + idcp, ["ocpp1.6", "ocpp1.5"]); //re connect
    }, 2000);
  }
  //unlock connector
  if (objmsg[2] == "UnlockConnector") {
    //disconnect CP pwm signal
    setTimeout(() => {
      //  serialport.write("req_unlockd!");
      UnlockConnector(connection);
    }, 100);
  }
  //data transfer
  if (objmsg[2] == "DataTransfer") {
    DataTransfer(connection, "Rejected"); //Accepted,Rejected,UnknownMessageId,UnknownVendorId
  }
  //getlocallistversion
  if (objmsg[2] == "GetLocalListVersion") {
    let listVersion;
    setTimeout(() => {
      mysqlstr = "select listVersion from locallist where 1";
      dbconn.query(mysqlstr, (err, results, fields) => {
        listVersion = results[0].listVersion;
        console.log(results[0]);
      });
    }, 100);
    setTimeout(() => {
      GetLocalListVersion(connection, listVersion); //LocalListVersion
    }, 500);
  }
  //sendlocallist
  if (objmsg[2] == "SendLocalList") {
    let getLength = objmsg[3].localAuthorizationList.length;
    console.log(getLength);
    let updateType = objmsg[3].updateType;
    console.log(updateType);
    if (updateType == "Differential") {
      SendLocalList(connection, "NotSupported"); //Accepted,Failed,NotSupported,VersionMismatch
      return;
    }

    if (getLength == 0 && updateType == "Full") {
      //clear database table locallist
      setTimeout(() => {
        mysqlstr = "delete from locallist where 1";
        dbconn.query(mysqlstr, (err, results, fields) => {
          //  res.end(JSON.stringify(results)); //send response
        });
      }, 100);
      setTimeout(() => {
        SendLocalList(connection, "Accepted"); //Accepted,Failed,NotSupported,VersionMismatch
      }, 500);
    }
    if (getLength > 0 && updateType == "Full") {
      setTimeout(() => {
        mysqlstr = "delete from locallist where 1";
        dbconn.query(mysqlstr, (err, results, fields) => {
          //  res.end(JSON.stringify(results)); //send response
        });
      }, 100);
      setTimeout(() => {
        for (let j = 0; j < getLength; j++) {
          let listVersion_LocalList = objmsg[3].listVersion;
          let idTag_LocalList = objmsg[3].localAuthorizationList[j].idTag;
          let idTagInfo_status_LocalList =
            objmsg[3].localAuthorizationList[j].idTagInfo.status;
          let idTagInfo_expiryDate_LocalList =
            objmsg[3].localAuthorizationList[j].idTagInfo.expiryDate;
          let idTagInfo_parentIdTag_LocalList =
            objmsg[3].localAuthorizationList[j].idTagInfo.parentIdTag;

          mysqlstr =
            "insert into locallist(listVersion,idTag,status,expiryDate,parentIdTag) values(?,?,?,?,?)";
          var values = [
            listVersion_LocalList,
            idTag_LocalList,
            idTagInfo_status_LocalList,
            idTagInfo_expiryDate_LocalList,
            idTagInfo_parentIdTag_LocalList,
          ];
          dbconn.query(mysqlstr, values, (err, results) => {
            if (err) {
              return;
            } //if fail or database already have save rfid tag value
            console.log("Authorization List added !");
          });
        }
      }, 500);
      setTimeout(() => {
        SendLocalList(connection, "Accepted"); //Accepted,Failed,NotSupported,VersionMismatch
      }, 800);
    }
  }
  //triggermessage
  if (objmsg[2] == "TriggerMessage") {
    let requestedMessage = objmsg[3].requestedMessage;
    if (requestedMessage == "BootNotification") {
      // setTimeout(() => {
      BootNotificationReq(
        connection,
        CPVendor,
        CPModel,
        CPNum,
        CBoxNum,
        fwVersion,
        iccid,
        imsi,
        meterType,
        meterSN
      );
      TriggerMessage(connection, "Accepted");
    }
    if (requestedMessage == "DiagnosticsStatusNotification") {
      DiagnosticsStatusNotificationReq(connection, "Idle");
      TriggerMessage(connection, "Rejected");
    }
    if (requestedMessage == "FirmwareStatusNotification") {
      FirmwareStatusNotificationReq(connection, "Idle");
      TriggerMessage(connection, "Rejected");
    }
    if (requestedMessage == "Heartbeat") {
      HeartbeatReq(connection);
      TriggerMessage(connection, "Accepted");
    }
    if (requestedMessage == "MeterValues") {
      TriggerMessage(connection, "NotImplemented");
      // MeterValuesReq(
      //   connection,
      //   connectorId,
      //   transId,
      //   meterkwhvalue,
      //   "Raw",
      //   "Energy.Active.Import.Register",
      //   "Sample.Periodic",
      //   "L1",
      //   "kWh"
      // );
      //  MeterValuesReq(
      //    connection,
      //    connectorId,
      //    transId,
      //    measurandarray,refreshmetervaluearray
      //  );
    }
    if (requestedMessage == "StatusNotification") {
      StatusNotificationReq(connection, connectorId, cperrorcode, cpstatus);
      TriggerMessage(connection, "Accepted");
    }
  }
  //getcompositeschedule
  if (objmsg[2] == "GetCompositeSchedule") {
    GetCompositeSchedule(connection, "Rejected"); //Accepted,Rejected
  }
  //ClearChargingProfile
  if (objmsg[2] == "ClearChargingProfile") {
    ClearChargingProfile(connection, "Unknown"); //Accepted,Unknown
  }
  //SetChargingProfile
  if (objmsg[2] == "SetChargingProfile") {
    SetChargingProfile(connection, "NotSupported"); //Accepted,Rejected,NotSupported
  }
}
//******************************************************************** */
//CP send req, CS send conf
//check for received conf from CS

function check_msg(connection) {
  var la = sessionstorage.getItem("LastAction");

  if (la == "Authorize") {
    let authResponse = objmsg[2].idTagInfo.status; //check Authorize.conf
    // if (authResponse == "Invalid" && stoptransactiononinvalidid == true) {//if invalid rfid and stoptransaction on invalidid is enable
    //   //stop transaction

    //    let reason = "DeAuthorized";
    //    StopTransactionReq(connection, transId, meterkwhvalue, reason);//stop transaction, reason: deatuhtorized
    //    serialport.write("req_cutchrg!");//stop charging
    // }
    if (authResponse == "Invalid" && allowofflinetxforunknownid == 0) {
      //   serialport.write("rev_flagtap!");
    }
    if (
      authResponse == "Invalid" &&
      allowofflinetxforunknownid == 1 &&
      rfidTranscStatus == "strt"
    ) {
      setTimeout(() => {
        let reason = "Local";
        rfidTranscStatus == "stop";
        StopTransactionReq(connection, transId, meterkwhvalue, reason);
      }, 200);
      setTimeout(() => {
        if (idinterval > 0) {
          clearInterval(idinterval);
        }
        serialport.write("req_cutchrg!");
      }, 400);
    }
    if (authResponse == "Accepted") {
      //if accepted, then wait for determined time, then check status plug/connector
      setTimeout(() => {
        if (plugstatusstr == "plugOff") {
          serialport.write("req_cutchrg!");
        }
      }, intervaltimeout * 1000);
    }
    if (authResponse == "Accepted" && rfidTranscStatus == "strt") {
      setTimeout(() => {
        meterkwhvalue = parseFloat(metervaluearray[5]);
        StartTransactionReq(connection, connectorId, IdToken, meterkwhvalue);
      }, 200);
    }
    if (authResponse == "Accepted" && rfidTranscStatus == "stop") {
      setTimeout(() => {
        meterkwhvalue = parseFloat(metervaluearray[5]);
        let reason = "Local";
        StopTransactionReq(connection, transId, meterkwhvalue, reason);
      }, 200);
    }
  }

  if (la == "BootNotification") {
    let status = objmsg[2].status;
    interval = objmsg[2].interval;

    console.log(status);
    console.log(`interval : ${interval}`);

    if (status == "Accepted") {
      setTimeout(() => {
        //read from arduino or other ocpp process then pass proper one
        //CP send StatusNotification.req to CS
        StatusNotificationReq(connection, 1, cperrorcode, cpstatus);
      }, 200);
      setTimeout(() => {
        //read from arduino or other ocpp process then pass proper one
        //CP send StatusNotification.req to CS
        StatusNotificationReq(connection, 2, cperrorcode, cpstatus);
      }, 400);
      setTimeout(() => {
        //read from arduino or other ocpp process then pass proper one
        //CP send StatusNotification.req to CS
        StatusNotificationReq(connection, 3, cperrorcode, cpstatus);
      }, 600);
      setTimeout(() => {
        //read from arduino or other ocpp process then pass proper one
        //CP send StatusNotification.req to CS
        StatusNotificationReq(connection, 4, cperrorcode, cpstatus);
      }, 800);
      setTimeout(() => {
        //read from arduino or other ocpp process then pass proper one
        //CP send StatusNotification.req to CS
        StatusNotificationReq(connection, 5, cperrorcode, cpstatus);
      }, 1000);
      setTimeout(() => {
        //read from arduino or other ocpp process then pass proper one
        //CP send StatusNotification.req to CS
        StatusNotificationReq(connection, 6, cperrorcode, cpstatus);
      }, 1200);
    }
    if (status == "Pending") {
      //read GetConfiguration.req from CS and return GetConfiguration.conf to CS
    }
    if (status == "Rejected") {
      //CP send BootNotification.req at interval set until have BootNotification.conf with Accepted status

      setInterval(() => {
        BootNotificationReq(
          connection,
          CPVendor,
          CPModel,
          CPNum,
          CBoxNum,
          fwVersion,
          iccid,
          imsi,
          meterType,
          meterSN
        );
      }, interval * 1000);
    }
  }

  if (la == "StatusNotification") {
    //continue CP Normal operation
    //clear cperrorcode and cpstatus
    flagColdBoot = true;
    //then send heartbeat.req

    setTimeout(() => {
      //Heartbeat.req from CP to CS
      HeartbeatReq(connection);
    }, 500);

    // mysqlstr = "select HeartbeatInterval from configcp where 1";
    // dbconn.query(mysqlstr, (err, results, fields) => {
    //   interval = results[0].HeartbeatInterval;
    //   console.log("heartbeat interval = " + interval + " seconds");
    // });
  }
  if (la == "Heartbeat") {
    setInterval(() => {
      HeartbeatReq(connection);
    }, heartbeatinterval * 1000); //miliseconds
  }
  if (la == "MeterValues") {
  }
  if (la == "diagnosticsStatusNotification") {
  }

  if (la == "firmwareStatusNotification") {
  }

  if (la == "startTransaction") {
    transId = objmsg[2].transactionId;
    // console.log("transid : " + transId);
    // console.log("interval meter value every : " + intervalMeterValue);

    //match id with transid in object
    setTimeout(() => {
      for (let k = 0; k < currentTx.length; k++) {
        // console.log("isi current tx : " + currentTx[k].id);
        if (currentTx[k].id == connectorId) {
          // console.log("connector id aktif distart : " + currentTx[k].id);
          currentTx[k].txid = transId;
        }
      }
    }, 100);

    //call reading meter every interval meter value set
    setTimeout(() => {
      // console.log(currentTx);
      for (let k = 0; k < currentTx.length; k++) {
        if (currentTx[k].txid > 0 && currentTx[k].idinterval == 0) {
          // console.log("set interval for " + currentTx[k].id);
          if (currentTx[k].id == 1) {
            addrMBArray = [0x033f, 0x0342, 0x0346, 0x034e, 0x0352, 0x0351];
          }
          if (currentTx[k].id == 2) {
            addrMBArray = [0x0340, 0x0343, 0x0347, 0x034f, 0x0354, 0x0351];
          }
          if (currentTx[k].id == 3) {
            addrMBArray = [0x0341, 0x0344, 0x0348, 0x0350, 0x0356, 0x0351];
          }
          // if (currentTx[k].id == 4) {
          //   addrMBArray = [0x033f, 0x0342, 0x0346, 0x034e, 0x0352, 0x0351];
          // }
          // if (currentTx[k].id == 5) {
          //   addrMBArray = [0x0340, 0x0343, 0x0347, 0x034f, 0x0354, 0x0351];
          // }
          // if (currentTx[k].id == 6) {
          //   addrMBArray = [0x0341, 0x0344, 0x0348, 0x0350, 0x0356, 0x0351];
          // }
          // console.log(
          //   "konektor : " + currentTx[k].id + " address modbus " + addrMBArray
          // );

          if (intervalMeterValue > 0) {
            idintervalArray[k] = setInterval(() => {
              setTimeout(() => {
                if (currentTx[k].id == 1) {
                  addrMBArray = [
                    0x033f, 0x0342, 0x0346, 0x034e, 0x0352, 0x0351,
                  ];
                }
                if (currentTx[k].id == 2) {
                  addrMBArray = [
                    0x0340, 0x0343, 0x0347, 0x034f, 0x0354, 0x0351,
                  ];
                }
                if (currentTx[k].id == 3) {
                  addrMBArray = [
                    0x0341, 0x0344, 0x0348, 0x0350, 0x0356, 0x0351,
                  ];
                }
                // if (currentTx[k].id == 4) {
                //   addrMBArray = [
                //     0x033f, 0x0342, 0x0346, 0x034e, 0x0352, 0x0351,
                //   ];
                // }
                // if (currentTx[k].id == 5) {
                //   addrMBArray = [
                //     0x0340, 0x0343, 0x0347, 0x034f, 0x0354, 0x0351,
                //   ];
                // }
                // if (currentTx[k].id == 6) {
                //   addrMBArray = [
                //     0x0341, 0x0344, 0x0348, 0x0350, 0x0356, 0x0351,
                //   ];
                // }
              }, 100);
              //  setTimeout(() => {
              //    console.log("run addreess : " + addrMBArray + " for konektor : " + currentTx[k].id);
              //  }, 300);

              currentTx[k].idinterval = 1;
              setTimeout(() => {
                mbconn.setID(7);
                mbconn.setTimeout(mbsTimeout);
              }, 500);
              setTimeout(() => {
                mbconn
                  .readHoldingRegisters(addrMBArray[0], 2) //voltage
                  .then(function (data) {
                    let tempnum = data.data[0] + data.data[1];
                    metervoltage = convertNumber(tempnum);
                    metervoltage = metervoltage / 10;
                  })
                  .catch(function (e) {
                    console.log(e);
                  });
              }, 800);
              setTimeout(() => {
                mbconn
                  .readHoldingRegisters(addrMBArray[1], 2) //current
                  .then(function (data) {
                    let tempnum = data.data[0] + data.data[1];
                    metercurrent = (convertNumber(tempnum) * ctratio) / 100;
                  })
                  .catch(function (e) {
                    console.log(e);
                  });
              }, 1100);
              setTimeout(() => {
                mbconn
                  .readHoldingRegisters(addrMBArray[2], 2) //active power
                  .then(function (data) {
                    let tempnum = data.data[0] + data.data[1];
                    meterpower = (convertNumber(tempnum) * ctratio) / 1000;
                  })
                  .catch(function (e) {
                    console.log(e);
                  });
              }, 1400);
              setTimeout(() => {
                mbconn
                  .readHoldingRegisters(addrMBArray[3], 2) //power factor
                  .then(function (data) {
                    let tempnum = data.data[0];
                    meterpf = convertNumber(tempnum) / 1000;
                  })
                  .catch(function (e) {
                    console.log(e);
                  });
              }, 1700);
              setTimeout(() => {
                mbconn
                  .readHoldingRegisters(addrMBArray[4], 4) //active energy
                  .then(function (data) {
                    let tempnum =
                      data.data[0] + data.data[1] + data.data[2] + data.data[3];
                    meterkwhvalue = (convertNumber(tempnum) * ctratio) / 100;
                  })
                  .catch(function (e) {
                    console.log(e);
                  });
              }, 2000);
              setTimeout(() => {
                mbconn
                  .readHoldingRegisters(addrMBArray[5], 1) //frequency
                  .then(function (data) {
                    meterfreq = convertNumber(data.data) / 100;
                  })
                  .catch(function (e) {
                    console.log(e);
                  });
              }, 2300);

              setTimeout(() => {
                MeterValuesReq(
                  connection,
                  currentTx[k].id,
                  currentTx[k].txid,
                  measurandarray,
                  [
                    metervoltage,
                    metercurrent,
                    meterpower,
                    meterpf,
                    meterfreq,
                    meterkwhvalue,
                  ]
                );
              }, 2600);
            }, intervalMeterValue * 1000 + 3000 * currentTx[k].id);
          }
        }
      }
    }, 300);
  }
  if (la == "stopTransaction") {
    for (let m = 0; m < 6; m++) {
      if (currentTx[m].txid == 0 && currentTx[m].idinterval > 0) {
        setTimeout(() => {
          clearInterval(idintervalArray[m]);
        }, 500);
        setTimeout(() => {
          currentTx[m].idinterval = 0;
        }, 1000);
        setTimeout(() => {
          console.log(
            "Connector - " +
              currentTx[m].id +
              " OFF ! , no meter value send from this connector!!"
          );
        }, 1200);
      }
    }
  }
  if (la == "") {
  }
}
//write to file
async function writeLog(filename, content) {
  try {
    await fs.appendFile(filename, content);
  } catch (err) {
    console.log(err);
  }
}

//FTP HANDLER FUNCTION
// async function operationWithFTP() {
//   // initialize the FTP client
//   const client = new ftp.Client();

//   try {
//     // connect to the FTP/FTPS server
//     await client.access({
//       host: "ftp.dlptest.com",
//       user: "dlpuser",
//       password: "rNrKYTX9g7z3RgJRmxWuGHbeu",
//       secure: false, // true for FTPS and false for FTP
//     });

//     // perform operations on the FTP server...
//   } catch (e) {
//     console.log(e);
//   }
//   console.log("konek");
//   // close the client connection
//   client.close();
// }

async function uploadFileToFTP(
  localFile,
  remotePath,
  host,
  user,
  password,
  port
) {
  const ftpclient = new ftp.Client();

  try {
    await ftpclient.access({
      host: host,
      user: user,
      password: password,
      port: port,
      secure: false,
    });

    // upload the local file located in localFile
    // to remotePath
    await ftpclient.uploadFrom(localFile, remotePath);
  } catch (err) {
    console.log(err);
  }

  ftpclient.close();
  console.log("ftp client close");
}
async function downloadFileFromFTP(
  localFile,
  remotePath,
  host,
  user,
  password,
  port
) {
  const ftpclient = new ftp.Client();

  try {
    await ftpclient.access({
      host: host,
      user: user,
      password: password,
      port: port,
      secure: false,
    });

    // download the remote file located to remotePath
    // and store it to localFile
    await ftpclient.downloadTo(localFile, remotePath);
  } catch (err) {
    console.log(err);
  }
  ftpclient.close();
  console.log("ftp client close");
}
