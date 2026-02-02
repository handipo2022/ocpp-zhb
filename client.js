const WebSocketClient = require("websocket").client; //import websocket module
const chargerDb = require("./dbclient.js");

const url = "ws://127.0.0.1:8080/steve/websocket/CentralSystemService/";
const id = "BDTEST1";
const protocol = ["ocpp1.6", "ocpp1.6j"];
const possible =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

let interval;
let intervalId;

const pendingRequests = {}; //{uniqueId : action}

const generateRandomString = () => {
  let randomString = "";
  for (let i = 0; i < 36; i++) {
    randomString += possible.charAt(
      Math.floor(Math.random() * possible.length)
    );
  }
  return randomString;
};

//----------------------------------------------
//Payloads
//-----------------------------------------------
const BootNotification_payload = {
  chargePointVendor: "MyVendor",
  chargePointModel: "MyModel",
  chargePointSerialNumber: "SN123456",
  firmwareVersion: "1.0.0",
  iccid: "1234567890",
  imsi: "9876543210",
  meterSerialNumber: "MTR123456",
  meterType: "SmartMeter",
};
const Heartbeat_payload = {};

const StatusNotification_payload = {
  connectorId: 1,
  status: "Available",
  errorCode: "NoError",
  timestamp: new Date().toISOString(),
};
//------------------------------------------------

//connect to ocpp server
const connectWS = async (url, id, protocol) => {
  return new Promise((resolve, reject) => {
    const client = new WebSocketClient();
    client.connect(`${url}${id}`, protocol);

    client.on("connectFailed", (error) => {
      reject(error);
    });

    client.on("connect", (connection) => {
      resolve(connection);
    });
  });
};

//send OCPP msg function (from client to server)
const sendOCPPMsg = (connection, action, payload) => {
  const uniqueId = generateRandomString();
  const msg = [2, uniqueId, action, payload];
  pendingRequests[uniqueId] = action;
  connection.sendUTF(JSON.stringify(msg));
};

// Handle server responses
const handleResponse = (connection, action, payload) => {
  switch (action) {
    case "BootNotification":
      if (payload.status === "Accepted") {
        if (intervalId) {
          clearInterval(intervalId);
        }
        interval = payload.interval || 10;
        sendOCPPMsg(
          connection,
          "StatusNotification",
          StatusNotification_payload
        );
      } else if (
        payload.status === "Pending" ||
        payload.status === "Rejected"
      ) {
        interval = payload.interval || 10;
        intervalId = setInterval(
          () =>
            sendOCPPMsg(
              connection,
              "BootNotification",
              BootNotification_payload
            ),
          interval * 1000
        );
      }
      break;

    case "StatusNotification":
      setInterval(
        () => sendOCPPMsg(connection, "Heartbeat", Heartbeat_payload),
        interval * 1000
      );
      break;
  }
};

//main function
const main = async () => {
  try {
    const connection = await connectWS(url, id, protocol);
    console.log("Connected to websocket");

    connection.on("error", (error) => {
      console.error("Connection error:", error);
    });
    connection.on("close", () => {
      console.log("Connection closed");
    });
    connection.on("message", (message) => {
      if (message.type === "utf8") {
        console.log(`Received response : ${message.utf8Data}`);
        const data = JSON.parse(message.utf8Data);
        const messageType = data[0];

        if (messageType === 3) {
          // CALLRESULT
          const uniqueId = data[1];
          const payload = data[2];
          const action = pendingRequests[uniqueId];
          delete pendingRequests[uniqueId];
          handleResponse(connection, action, payload);
        } else if (messageType === 4) {
          // CALLERROR
          const uniqueId = data[1];
          const errorCode = data[2];
          const errorDescription = data[3];
          console.error(
            `Error response for ${pendingRequests[uniqueId]}: ${errorCode} - ${errorDescription}`
          );
          delete pendingRequests[uniqueId];
        } else {
          console.log("Received non-response message:", data);
        }
      }
    });

    sendOCPPMsg(connection, "BootNotification", BootNotification_payload);
  } catch (err) {
    console.log(err);
  }
};

const dbase = chargerDb.runDb();
const sql = `
    INSERT INTO BootNotification 
    (chargePointVendor, chargePointModel, chargePointSerialNumber, firmwareVersion, iccid, imsi, meterSerialNumber, meterType) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
const data = {
  chargePointVendor: "XYZ",
  chargePointModel: "Model XXYZ1",
  chargePointSerialNumber: "SN1234567890",
  firmwareVersion: "0.0.1",
  iccid: "1234",
  imsi: "987654321",
  meterSerialNumber: "Meter123456789",
  meterType: "Meter type 1",
};
chargerDb.insertData(dbase, sql, data);
main();
