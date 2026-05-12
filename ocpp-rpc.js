const { RPCClient } = require("ocpp-rpc");
const chargerDb = require("./dbclient.js");
const name = "./charger.db";

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

// connect database
const db = chargerDb.connect(name);

let cli,
  sql,
  result,
  response,
  interval,
  payload,
  arr = [],
  obj = {};

// helper to read database
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
const readAllData = (sql) => {
  return new Promise((resolve, reject) => {
    chargerDb.readAll(db, sql, (err, row) => {
      if (err) {
        return reject(err);
      } else {
        resolve(row);
      }
    });
  });
};
const BootNotificationPayload = async () => {
  try {
    sql = `SELECT * FROM chargerdata WHERE id = ?`;
    result = await readData(sql, [1]);
    return {
      chargeBoxSerialNumber: result.chargeBoxSerialNumber,
      chargePointVendor: result.chargePointVendor,
      chargePointModel: result.chargePointModel,
      chargePointSerialNumber: result.chargePointSerialNumber,
      firmwareVersion: result.firmwareVersion,
      iccid: result.iccid,
      imsi: result.imsi,
      meterSerialNumber: result.meterSerialNumber,
      meterType: result.meterType,
    };
  } catch (err) {
    console.error("Error building BootNotificationPayload:", err);
    throw err;
  }
};
const StatusNotificationPayload = async () => {
  try {
    // get all connector rows
    sql = `SELECT * FROM connector`;
    result = await readAllData(sql);
    arr.length = 0;
    arr = result.map((row) => ({
      connectorId: row.connectorId,
      status: row.status,
      errorCode: row.errorCode,
      timestamp: new Date().toISOString(),
    }));

    return arr;
  } catch (err) {
    console.error("Error building StatusNotificationPayload:", err);
    throw err;
  }
};
/**
 * Connects to OCPP server and sends BootNotification
 */
const connectAndBoot = async () => {
  try {
    sql = `SELECT * FROM ocpp WHERE id = ?`;
    result = await readData(sql, [1]);

    cli = new RPCClient({
      endpoint: result.url.slice(0, result.url.length - 1), // the OCPP endpoint URL
      identity: result.chargerid, // the OCPP identity
      protocols: ["ocpp1.6"], // client understands ocpp1.6 subprotocol
      strictMode: true, // enable strict validation of requests & responses
    });

    await cli.connect();

    //handle ocpp request from csms
    //----------------------------------------------------------------------
    cli.handle("ChangeConfiguration", async (payload) => {
      console.log("Received ChangeConfiguration:", payload.params.key);

      try {
        sql = `UPDATE configuration SET ${payload.params.key} = ?`;
        await chargerDb.run(db, sql, [payload.params.value]);
        console.log("Change configuration success !");
        return { status: "Accepted" };
      } catch (err) {
        console.error("Failed to apply ChangeConfiguration:", err);
        return { status: "Rejected" };
      }
    });

    cli.handle("GetConfiguration", async (payload) => {
      console.log("Received GetConfiguration:", payload.params.key);
      try {
        arr.length = 0;
        for (let j = 0; j < payload.params.key.length; j++) {
          arr.push(payload.params.key[j]);
        }
        sql = `SELECT ${arr.join(", ")} FROM configuration WHERE id = ?`;
        result = await readData(sql, [1]);
        arr.length = 0;
        obj = {};
        for (let j = 0; j < Object.keys(result).length; j++) {
          obj = {
            key: Object.keys(result)[j],
            readonly: readOnlyConfiguration.includes(Object.keys(result)[j])
              ? true
              : false,
            value: Object.values(result)[j].toString(),
          };
          arr.push(obj);
        }
        console.log(arr);
        return {
          configurationKey: arr,
        };
      } catch (err) {
        console.log("Failed to apply GetConfiguration:", err);
        return { status: "Rejected" };
      }
    });

    cli.handle("Reset", async (payload) => {
      console.log("Received Reset:", payload.params.type);
      try {
        // Close the current WebSocket connection
        if (cli && cli.ws && cli.ws.close) {
          cli.ws.close(); // force close the WebSocket
          console.log("Closed existing WebSocket connection");
        }
        // Reconnect to CSMS
        const { cli: newCli, response } = await connectAndBoot();
        console.log("Reconnected successfully");
        return { status: "Accepted" };
      } catch (err) {
        console.error("Failed to reset and reconnect:", err);
        return { status: "Rejected" };
      }
    });
    //--------------------------------------------------------------------
    //Cold Boot
    response = await cli.call(
      "BootNotification",
      await BootNotificationPayload()
    );
    console.log(response);
    interval = response.interval;

    if (response.status === "Accepted") {
      payload = await StatusNotificationPayload();
      for (const element of payload) {
        await sendStatusNotification(cli, element);
      }
      setInterval(async () => {
        await sendHeartbeat(cli);
      }, 10 * 1000); //change with interval in bootResponse
    } else {
      console.log(response.status);
    }

    return { cli, response };
  } catch (err) {
    console.error("Error in connectAndBoot:", err);
    throw err;
  }
};

/**
 * Sends Heartbeat request
 */
const sendHeartbeat = async (cli) => {
  try {
    response = await cli.call("Heartbeat", {});
    console.log(response);
    return response;
  } catch (err) {
    console.error("Error in sendHeartbeat:", err);
    throw err;
  }
};

/**
 * Sends StatusNotification request
 */
const sendStatusNotification = async (cli, payload) => {
  try {
    response = await cli.call("StatusNotification", payload);
    console.log(response);
    return response;
  } catch (err) {
    console.error("Error in sendStatusNotification:", err);
    throw err;
  }
};

module.exports = { connectAndBoot, sendHeartbeat, sendStatusNotification };
