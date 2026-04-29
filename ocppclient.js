const WebSocketClient = require("websocket").client; //import websocket module
const chargerDb = require("./dbclient.js");
const name = "./charger.db";

const possible =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

let row, row1, BootNotification_payload, StatusNotification_payload;
const protocol = ["ocpp1.6", "ocpp1.6j"];

let interval;
let intervalId;

const pendingRequests = {}; //{uniqueId : action}

const readOnlyConfiguration = [
  "GetConfigurationMaxKeys",
  "MeterValuesAlignedDataMaxLength",
  "MeterValuesSampledDataMaxLength",
  "NumberOfConnectors",
  "StopTxnAlignedDataMaxLength",
  "ConnectorPhaseRotationMaxLength",
  "StopTxnSampledDataMaxLength",
  "SupportedFeatureProfiles",
  "SupportedFeatureProfilesMaxLength",
  "LocalAuthListMaxLength",
  "SendLocalListMaxLength",
  "ReserveConnectorZeroSupported",
  "ChargeProfileMaxStackLevel",
  "ChargingScheduleAllowedChargingRateUnit",
  "ChargingScheduleMaxPeriods",
  "ConnectorSwitch3to1PhaseSupported",
  "MaxChargingProfilesInstalled",
];
//connect dbase
const db = chargerDb.connect(name);

//read database ,pass as payload in ocpp message
const readData = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    chargerDb.read(db, sql, params, (err, row) => {
      if (err) {
        return reject(err);
      } else {
        resolve(row);
      }
    });
  });
};
const BootNotificationPayload = async () => {
  row = await readData(`SELECT * FROM chargerdata WHERE id = ?`, [1]);
  return {
    chargeBoxSerialNumber: row.chargeBoxSerialNumber,
    chargePointVendor: row.chargePointVendor,
    chargePointModel: row.chargePointModel,
    chargePointSerialNumber: row.chargePointSerialNumber,
    firmwareVersion: row.firmwareVersion,
    iccid: row.iccid,
    imsi: row.imsi,
    meterSerialNumber: row.meterSerialNumber,
    meterType: row.meterType,
  };
};

const StatusNotificationPayload = async () => {
  //get number of gun
  row = await readData(`SELECT numgun FROM ocpp WHERE id = ?`, [1]);

  //get all connector data
  let array = [];
  row1 = await readData(`SELECT * FROM connector`);
  for (let j = 1; j <= row.numgun; j++) {
    array.push({
      connectorId: row1.connectorId,
      status: row1.status,
      errorCode: row1.errorCode,
      timestamp: new Date().toISOString(),
    });
  }
  return array;
};

const generateRandomString = () => {
  let randomString = "";
  for (let i = 0; i < 36; i++) {
    randomString += possible.charAt(
      Math.floor(Math.random() * possible.length)
    );
  }
  return randomString;
};

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
        StatusNotification_payload.forEach((element) => {
          sendOCPPMsg(connection, "StatusNotification", element);
        });
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
        () => sendOCPPMsg(connection, "Heartbeat", {}),
        interval * 1000
      );
      break;
    case "ChangeConfiguration":
      const key = payload[2].key;
      const value = payload[2].value;
      console.log(`key : ${key}, value : ${value}`);

      const sql = `
  UPDATE configuration
  SET ${key} = ?
`;
      var msg = [];
      db.run(sql, value, (err) => {
        if (err) {
          console.error(err);
          msg = [payload[0], payload[1], { status: "Rejected" }]; //send response back to server
        } else {
          console.log("Insert data success");
          msg = [payload[0], payload[1], { status: "Accepted" }];
        }
        connection.sendUTF(JSON.stringify(msg));
      });

      break;
    case "GetConfiguration":
      (async () => {
        var tempArray = [];
        for (let j = 0; j < payload[2].key.length; j++) {
          tempArray.push(payload[2].key[j]);
        }
        try {
          const row = await readData(
            `SELECT ${tempArray.toString()} FROM configuration WHERE id = ?`,
            [1]
          );
          var msg = [];
          const keyArray = Object.keys(row);
          const valueArray = Object.values(row);
          var configObj = {};
          var tempArray = [];
          for (let j = 0; j < keyArray.length; j++) {
            const obj = {
              key: keyArray[j],
              readonly: readOnlyConfiguration.includes(keyArray[j])
                ? true
                : false,
              value: valueArray[j],
            };
            tempArray.push(obj);
          }
          configObj.configurationKey = tempArray;
          msg = [payload[0], payload[1], configObj];
          connection.sendUTF(JSON.stringify(msg));
        } catch (err) {
          console.error("Error reading data:", err);
        }
      })();
      break;
    default:
      break;
  }
};

//main function
const main = async () => {
  try {
    row = await readData(`SELECT * FROM ocpp WHERE id = ?`, [1]);
    const connection = await connectWS(row.url, row.chargerid, protocol);
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
        if (messageType === 2) {
          const uniqueId = data[1];
          const action = data[2];
          const payload = data[3];
          handleResponse(connection, action, [3, uniqueId, payload]);
        } else if (messageType === 3) {
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
    BootNotification_payload = await BootNotificationPayload();
    sendOCPPMsg(connection, "BootNotification", BootNotification_payload);
    StatusNotification_payload = await StatusNotificationPayload();
  } catch (err) {
    console.log(err);
  }
};

module.exports = { connectWS, sendOCPPMsg, handleResponse, readData, main };
