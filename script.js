var myurl;
var pathname;
const port = 3000;
const hostname = `http://localhost:${port}`;

async function loaddata() {
  const url = `${hostname}/detailcp/loaddata`;
  try {
    const response = await fetch(url);
    if (response.status === 200) {
      const result = await response.json();
      document.getElementById("cbsn").value =
        result.chargeBoxSerialNumber || "";
      document.getElementById("cpmodel").value = result.chargePointModel || "";
      document.getElementById("cpsn").value =
        result.chargePointSerialNumber || "";
      document.getElementById("cpvendor").value =
        result.chargePointVendor || "";
      document.getElementById("fwversion").value = result.firmwareVersion || "";
      document.getElementById("iccid").value = result.iccid || "";
      document.getElementById("imsi").value = result.imsi || "";
      document.getElementById("metersn").value = result.meterSerialNumber || "";
      document.getElementById("metertype").value = result.meterType || "";
    } else if (response.status === 404) {
      alert("Data not found");
    } else if (response.status === 500) {
      alert("Database query failed");
    }
  } catch (error) {
    console.error(error.message);
  }
}
async function loadocpp() {
  const url = `${hostname}/ocpp/loaddata`;
  try {
    const response = await fetch(url);
    if (response.status === 200) {
      const result = await response.json();
      document.getElementById("url").value = result.url || "";
      document.getElementById("chargerid").value = result.chargerid || "";
      document.getElementById("numgun").value = result.numgun || "";
    } else if (response.status === 404) {
      alert("Data not found");
    } else if (response.status === 500) {
      alert("Database query failed");
    }
  } catch (error) {
    console.error(error.message);
  }
}
async function savedata() {
  const url = `${hostname}/detailcp/savedata`;

  const data = {
    cbsn: document.getElementById("cbsn").value,
    cpmodel: document.getElementById("cpmodel").value,
    cpsn: document.getElementById("cpsn").value,
    cpvendor: document.getElementById("cpvendor").value,
    fwversion: document.getElementById("fwversion").value,
    iccid: document.getElementById("iccid").value,
    imsi: document.getElementById("imsi").value,
    metersn: document.getElementById("metersn").value,
    metertype: document.getElementById("metertype").value,
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(data),
    });
    if (response.status === 200) {
      alert("Success");
    }
    if (response.status === 500) {
      alert("Fail");
    }
  } catch (err) {
    console.log(err);
  }
}
async function saveocpp() {
  const url = `${hostname}/ocpp/savedata`;

  const data = {
    url: document.getElementById("url").value,
    chargerid: document.getElementById("chargerid").value,
    numgun: document.getElementById("numgun").value,
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(data),
    });
    if (response.status === 200) {
      alert("Success");
    }
    if (response.status === 500) {
      alert("Fail");
    }
  } catch (err) {
    console.log(err);
  }
}
const ocppConfiguration = [
  "AllowOfflineTxForUnknownId",
  "AuthorizationCacheEnabled",
  "AuthorizeRemoteTxRequests",
  "BlinkRepeat",
  "ClockAlignedDataInterval",
  "ConnectionTimeOut",
  "GetConfigurationMaxKeys",
  "HeartbeatInterval",
  "LightIntensity",
  "LocalAuthorizeOffline",
  "LocalPreAuthorize",
  "MaxEnergyOnInvalidId",
  "MeterValuesAlignedData",
  "MeterValuesAlignedDataMaxLength",
  "MeterValuesSampledData",
  "MeterValuesSampledDataMaxLength",
  "MeterValueSampleInterval",
  "MinimumStatusDuration",
  "NumberOfConnectors",
  "ResetRetries",
  "ConnectorPhaseRotation",
  "ConnectorPhaseRotationMaxLength",
  "StopTransactionOnEVSideDisconnect",
  "StopTransactionOnInvalidId",
  "StopTxnAlignedData",
  "StopTxnAlignedDataMaxLength",
  "StopTxnSampledData",
  "StopTxnSampledDataMaxLength",
  "SupportedFeatureProfiles",
  "SupportedFeatureProfilesMaxLength",
  "TransactionMessageAttempts",
  "TransactionMessageRetryInterval",
  "UnlockConnectorOnEVSideDisconnect",
  "WebSocketPingInterval",
  "LocalAuthListEnabled",
  "LocalAuthListMaxLength",
  "SendLocalListMaxLength",
  "ReserveConnectorZeroSupported",
  "ChargerProfileMaxStackLevel",
  "ChargingScheduleAllowedChargingRateUnit",
  "ChargingScheduleMaxPeriods",
  "ConnectorSwitch3to1PhaseSupported",
  "MaxChargingProfilesInstalled",
];

async function ChangeConfiguration() {
  //create data object
  var data = {};
  ocppConfiguration.forEach((item) => {
    data[item] = document.getElementById(item).value;
  });

  //define url
  const url = `${hostname}/configcp/changeconfiguration`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(data), //pass data into body
    });
    if (response.status === 200) {
      alert("Success");
    }
    if (response.status === 500) {
      alert("Fail");
    }
  } catch (err) {
    console.log(err);
  }
}

async function ReadConfiguration() {
  const url = `${hostname}/configcp/readconfiguration`;
  try {
    const response = await fetch(url);
    if (response.status === 200) {
      const result = await response.json();
      ocppConfiguration.forEach((item) => {
        document.getElementById(item).value = result[item];
      });
    } else if (response.status === 404) {
      alert("Data not found");
    } else if (response.status === 500) {
      alert("Database query failed");
    }
  } catch (error) {
    console.error(error.message);
  }
}
//updatestatussw();
// function updatestatussw() {
//   setInterval(() => {
//     pathname = "/relaystatus/update";
//     myurl = new URL(pathname, hostname);
//     // alert(myurl.toString());
//     var xhr = new XMLHttpRequest();
//     //xhr.withCredentials = true;
//     xhr.open("GET", myurl.href, true); //send request to server which process dbase
//     xhr.responseType = "text";
//     xhr.send();
//     xhr.onload = function () {
//       let temparray = JSON.parse(xhr.responseText);
//       console.log(temparray);
//       document.getElementById("inputStatus1").value = temparray[0].switchpos;
//       document.getElementById("inputStatus2").value = temparray[1].switchpos;
//       document.getElementById("inputStatus3").value = temparray[2].switchpos;
//       document.getElementById("inputStatus4").value = temparray[3].switchpos;
//       document.getElementById("inputStatus5").value = temparray[4].switchpos;
//       document.getElementById("inputStatus6").value = temparray[5].switchpos;
//     };
//   }, 1000);
// }
// function loaddata() {
//   pathname = "/detailcp/loaddata";
//   myurl = new URL(pathname, hostname);
//  alert(myurl.toString());
//   var xhr = new XMLHttpRequest();
//   //xhr.withCredentials = true;
//   xhr.open("GET", myurl.href, true); //send request to server which process dbase
//   xhr.responseType = "text";
//   xhr.send();
//   xhr.onload = function () {
//     //alert(xhr.responseText);
//     let temparray = JSON.parse(xhr.responseText);
//     document.getElementById("endpoint").value = temparray[0].endpointurl;
//     document.getElementById("cbid").value = temparray[0].chargeboxid;
//     document.getElementById("cbsn").value = temparray[0].cboxnum; //instal extension CORS and activate it at google chrome, so can be cross domain!!
//     document.getElementById("cpmodel").value = temparray[0].cpmodel;
//     document.getElementById("cpsn").value = temparray[0].cpnum;
//     document.getElementById("cpvendor").value = temparray[0].cpvendor;
//     document.getElementById("fwversion").value = temparray[0].fwversion;
//     document.getElementById("iccid").value = temparray[0].iccid;
//     document.getElementById("imsi").value = temparray[0].imsi;
//     document.getElementById("metersn").value = temparray[0].metersn;
//     document.getElementById("metertype").value = temparray[0].metertype;
//     document.getElementById("currentlimit").value = temparray[0].currentlimit;
//   };
// }

// async function sendData(data) {
//   const url = "http://localhost:3000/detailcp/savedata";

//   try {
//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json", // tell server it's JSON
//       },
//       body: JSON.stringify(data), // convert JS object to JSON string
//     });

//     if (!response.ok) {
//       throw new Error(`Server error: ${response.status}`);
//     }

//     const result = await response.json(); // parse JSON response
//     console.log("Server response:", result);
//     return result;
//   } catch (err) {
//     console.error("Request failed:", err);
//   }
// }

// // Example usage:
// sendData({
//   endpoint: "abc",
//   cbid: "123",
//   cbsn: "456",
//   cpmodel: "ModelX",
//   cpsn: "789",
//   cpvendor: "VendorY",
//   fwversion: "1.0.0",
//   iccid: "987654321",
//   imsi: "123456789",
//   metersn: "MTR001",
//   metertype: "TypeA",
// });
// async function savedata(){
//   var endpoint = document.getElementById("endpoint").value;
//   var cbid = document.getElementById("cbid").value;
//   var cbsn = document.getElementById("cbsn").value;
//   var cpmodel = document.getElementById("cpmodel").value;
//   var cpsn = document.getElementById("cpsn").value;
//   var cpvendor = document.getElementById("cpvendor").value;
//   var fwversion = document.getElementById("fwversion").value;
//   var iccid = document.getElementById("iccid").value;
//   var imsi = document.getElementById("imsi").value;
//   var metersn = document.getElementById("metersn").value;
//   var metertype = document.getElementById("metertype").value;
//   // var currentlimit = document.getElementById("currentlimit").value;
//   let data = {
//     endpoint: endpoint,
//     cbid: cbid,
//     cbsn: cbsn,
//     cpmodel: cpmodel,
//     cpsn: cpsn,
//     cpvendor: cpvendor,
//     fwversion: fwversion,
//     iccid: iccid,
//     imsi: imsi,
//     metersn: metersn,
//     metertype: metertype,
//     //   currentlimit: currentlimit,
//   };
//  console.log("Data sent in body request : "  ,JSON.stringify(data));
//   const url = "http://localhost:3000/detailcp/savedata";
//   const response = await fetch(url, {
//     method: "POST", // HTTP method
//     headers: {
//       "Content-Type": "application/json", // Tell server we're sending JSON
//     },
//     body: JSON.stringify(data), // Convert JS object to JSON string
//   });
//   if (response.status === 200) {
//     console.log("ok");
//   }
//   if (response.status === 500) {
//     console.log("fail");
//   }

//   //   // pathname = "/detailcp/savedata";
//   //   // myurl = new URL(pathname, hostname);
//   //   // var xhr = new XMLHttpRequest();
//   //   // xhr.open("POST", myurl.href, true);
//   //   // xhr.responseType = "text";
//   //   // xhr.send(json);
// };

// function GetConfiguration() {
//   pathname = "/configcp/getconfiguration";
//   myurl = new URL(pathname, hostname);
//   // alert(myurl.toString());
//   var xhr = new XMLHttpRequest();
//   //xhr.withCredentials = true;
//   xhr.open("GET", myurl.href, true); //send request to server which process dbase
//   xhr.responseType = "text";
//   xhr.send();
//   xhr.onload = function () {
//     //alert(xhr.responseText);
//     let temparray = JSON.parse(xhr.responseText);

//     document.getElementById("GetConfigurationMaxKeys").value =
//       temparray[0].GetConfigurationMaxKeys;
//     document.getElementById("MeterValuesAlignedDataMaxLength").value =
//       temparray[0].MeterValuesAlignedDataMaxLength;
//     document.getElementById("MeterValuesSampledDataMaxLength").value =
//       temparray[0].MeterValuesSampledDataMaxLength;
//     document.getElementById("NumberOfConnectors").value =
//       temparray[0].NumberOfConnectors;
//     document.getElementById("ConnectorPhaseRotationMaxLength").value =
//       temparray[0].ConnectorPhaseRotationMaxLength;
//     document.getElementById("StopTxnAlignedDataMaxLength").value =
//       temparray[0].StopTxnAlignedDataMaxLength;
//     document.getElementById("StopTxnSampledDataMaxLength").value =
//       temparray[0].StopTxnSampledDataMaxLength;
//     document.getElementById("SupportedFeatureProfilesMaxLength").value =
//       temparray[0].SupportedFeatureProfilesMaxLength;
//     document.getElementById("LocalAuthListMaxLength").value =
//       temparray[0].LocalAuthListMaxLength;
//     document.getElementById("SendLocalListMaxLength").value =
//       temparray[0].SendLocalListMaxLength;
//     document.getElementById("ReserveConnectorZeroSupported").value =
//       temparray[0].ReserveConnectorZeroSupported;
//     document.getElementById("ChargeProfileMaxStackLevel").value =
//       temparray[0].ChargeProfileMaxStackLevel;
//     document.getElementById("ChargingScheduleAllowedChargingRateUnit").value =
//       temparray[0].ChargingScheduleAllowedChargingRateUnit;
//     document.getElementById("ChargingScheduleMaxPeriods").value =
//       temparray[0].ChargingScheduleMaxPeriods;
//     document.getElementById("ConnectorSwitch3to1PhaseSupported").value =
//       temparray[0].ConnectorSwitch3to1PhaseSupported;
//     document.getElementById("MaxChargingProfilesInstalled").value =
//       temparray[0].MaxChargingProfilesInstalled;
//   };
// }
// function ReadConfiguration() {
//   pathname = "/configcp/readconfiguration";
//   myurl = new URL(pathname, hostname);
//   // alert(myurl.toString());
//   var xhr = new XMLHttpRequest();
//   //xhr.withCredentials = true;
//   xhr.open("GET", myurl.href, true); //send request to server which process dbase
//   xhr.responseType = "text";
//   xhr.send();
//   xhr.onload = function () {
//     //alert(xhr.responseText);
//     let temparray = JSON.parse(xhr.responseText);

//     if (temparray[0].AllowOfflineTxForUnknownId == 1) {
//       document.getElementById("AllowOfflineTxForUnknownId").value = "true";
//     } else if (temparray[0].AllowOfflineTxForUnknownId == 0) {
//       document.getElementById("AllowOfflineTxForUnknownId").value = "false";
//     }
//     if (temparray[0].AuthorizationCacheEnabled == 1) {
//       document.getElementById("AuthorizationCacheEnabled").value = "true";
//     } else if (temparray[0].AuthorizationCacheEnabled == 0) {
//       document.getElementById("AuthorizationCacheEnabled").value = "false";
//     }
//     if (temparray[0].AuthorizeRemoteTxRequests == 1) {
//       document.getElementById("AuthorizeRemoteTxRequests").value = "true";
//     } else if (temparray[0].AuthorizeRemoteTxRequests == 0) {
//       document.getElementById("AuthorizeRemoteTxRequests").value = "false";
//     }
//     document.getElementById("BlinkRepeat").value = temparray[0].BlinkRepeat;
//     document.getElementById("ClockAlignedDataInterval").value =
//       temparray[0].ClockAlignedDataInterval;
//     document.getElementById("ConnectionTimeOut").value =
//       temparray[0].ConnectionTimeOut;
//     document.getElementById("HeartbeatInterval").value =
//       temparray[0].HeartbeatInterval;
//     document.getElementById("LightIntensity").value =
//       temparray[0].LightIntensity;
//     if (temparray[0].LocalAuthListEnabled == 1) {
//       document.getElementById("LocalAuthListEnabled").value = "true";
//     } else if (temparray[0].LocalAuthListEnabled == 0) {
//       document.getElementById("LocalAuthListEnabled").value = "false";
//     }
//     if (temparray[0].LocalAuthorizeOffline == 1) {
//       document.getElementById("LocalAuthorizeOffline").value = "true";
//     } else if (temparray[0].LocalAuthorizeOffline == 0) {
//       document.getElementById("LocalAuthorizeOffline").value = "false";
//     }
//     if (temparray[0].LocalPreAuthorize == 1) {
//       document.getElementById("LocalPreAuthorize").value = "true";
//     } else if (temparray[0].LocalPreAuthorize == 0) {
//       document.getElementById("LocalPreAuthorize").value = "false";
//     }
//     document.getElementById("MaxEnergyOnInvalidId").value =
//       temparray[0].MaxEnergyOnInvalidId;
//     document.getElementById("MeterValuesAlignedData").value =
//       temparray[0].MeterValuesAlignedData;
//     document.getElementById("MeterValuesSampledData").value =
//       temparray[0].MeterValuesSampledData;
//     document.getElementById("MeterValueSampleInterval").value =
//       temparray[0].MeterValueSampleInterval;
//     document.getElementById("MinimumStatusDuration").value =
//       temparray[0].MinimumStatusDuration;
//     document.getElementById("ResetRetries").value = temparray[0].ResetRetries;
//     document.getElementById("ConnectorPhaseRotation").value =
//       temparray[0].ConnectorPhaseRotation;
//     if (temparray[0].StopTransactionOnEVSideDisconnect == 1) {
//       document.getElementById("StopTransactionOnEVSideDisconnect").value =
//         "true";
//     } else if (temparray[0].StopTransactionOnEVSideDisconnect == 0) {
//       document.getElementById("StopTransactionOnEVSideDisconnect").value =
//         "false";
//     }
//     if (temparray[0].StopTransactionOnInvalidId == 1) {
//       document.getElementById("StopTransactionOnInvalidId").value = "true";
//     } else if (temparray[0].StopTransactionOnInvalidId == 0) {
//       document.getElementById("StopTransactionOnInvalidId").value = "false";
//     }
//     document.getElementById("StopTxnAlignedData").value =
//       temparray[0].StopTxnAlignedData;
//     document.getElementById("StopTxnSampledData").value =
//       temparray[0].StopTxnSampledData;
//     document.getElementById("TransactionMessageAttempts").value =
//       temparray[0].TransactionMessageAttempts;
//     document.getElementById("TransactionMessageRetryInterval").value =
//       temparray[0].TransactionMessageRetryInterval;
//     if (temparray[0].UnlockConnectorOnEVSideDisconnect == 1) {
//       document.getElementById("UnlockConnectorOnEVSideDisconnect").value =
//         "true";
//     } else if (temparray[0].UnlockConnectorOnEVSideDisconnect == 0) {
//       document.getElementById("UnlockConnectorOnEVSideDisconnect").value =
//         "false";
//     }

//     document.getElementById("WebSocketPingInterval").value =
//       temparray[0].WebSocketPingInterval;
//     document.getElementById("savedIdToken").value = temparray[0].IdToken;
//     document.getElementById("lastTagIdToken").value =
//       temparray[0].LastTagIdToken;
//   };
// }

// function ChangeConfiguration() {
//   var AllowOfflineTxForUnknownId = document.getElementById(
//     "AllowOfflineTxForUnknownId"
//   ).value;
//   var AuthorizationCacheEnabled = document.getElementById(
//     "AuthorizationCacheEnabled"
//   ).value;
//   var AuthorizeRemoteTxRequests = document.getElementById(
//     "AuthorizeRemoteTxRequests"
//   ).value;
//   var BlinkRepeat = document.getElementById("BlinkRepeat").value;
//   var ClockAlignedDataInterval = document.getElementById(
//     "ClockAlignedDataInterval"
//   ).value;
//   var ConnectionTimeOut = document.getElementById("ConnectionTimeOut").value;
//   var HeartbeatInterval = document.getElementById("HeartbeatInterval").value;
//   var LightIntensity = document.getElementById("LightIntensity").value;
//   var LocalAuthListEnabled = document.getElementById(
//     "LocalAuthListEnabled"
//   ).value;
//   var LocalAuthorizeOffline = document.getElementById(
//     "LocalAuthorizeOffline"
//   ).value;
//   var LocalPreAuthorize = document.getElementById("LocalPreAuthorize").value;
//   var MaxEnergyOnInvalidId = document.getElementById(
//     "MaxEnergyOnInvalidId"
//   ).value;
//   var MeterValuesAlignedData = document.getElementById(
//     "MeterValuesAlignedData"
//   ).value;
//   var MeterValuesSampledData = document.getElementById(
//     "MeterValuesSampledData"
//   ).value;
//   var MeterValueSampleInterval = document.getElementById(
//     "MeterValueSampleInterval"
//   ).value;
//   var MinimumStatusDuration = document.getElementById(
//     "MinimumStatusDuration"
//   ).value;
//   var ResetRetries = document.getElementById("ResetRetries").value;
//   var ConnectorPhaseRotation = document.getElementById(
//     "ConnectorPhaseRotation"
//   ).value;
//   var StopTransactionOnEVSideDisconnect = document.getElementById(
//     "StopTransactionOnEVSideDisconnect"
//   ).value;
//   var StopTransactionOnInvalidId = document.getElementById(
//     "StopTransactionOnInvalidId"
//   ).value;
//   var StopTxnAlignedData = document.getElementById("StopTxnAlignedData").value;
//   var StopTxnSampledData = document.getElementById("StopTxnSampledData").value;
//   var TransactionMessageAttempts = document.getElementById(
//     "TransactionMessageAttempts"
//   ).value;
//   var TransactionMessageRetryInterval = document.getElementById(
//     "TransactionMessageRetryInterval"
//   ).value;
//   var UnlockConnectorOnEVSideDisconnect = document.getElementById(
//     "UnlockConnectorOnEVSideDisconnect"
//   ).value;
//   var WebSocketPingInterval = document.getElementById(
//     "WebSocketPingInterval"
//   ).value;

//   var IdToken = document.getElementById("savedIdToken").value;
//   let json = JSON.stringify({
//     AllowOfflineTxForUnknownId: AllowOfflineTxForUnknownId,
//     AuthorizationCacheEnabled: AuthorizationCacheEnabled,
//     AuthorizeRemoteTxRequests: AuthorizeRemoteTxRequests,
//     BlinkRepeat: BlinkRepeat,
//     ClockAlignedDataInterval: ClockAlignedDataInterval,
//     ConnectionTimeOut: ConnectionTimeOut,
//     HeartbeatInterval: HeartbeatInterval,
//     LightIntensity: LightIntensity,
//     LocalAuthListEnabled: LocalAuthListEnabled,
//     LocalAuthorizeOffline: LocalAuthorizeOffline,
//     LocalPreAuthorize: LocalPreAuthorize,
//     MaxEnergyOnInvalidId: MaxEnergyOnInvalidId,
//     MeterValuesAlignedData: MeterValuesAlignedData,
//     MeterValuesSampledData: MeterValuesSampledData,
//     MeterValueSampleInterval: MeterValueSampleInterval,
//     MinimumStatusDuration: MinimumStatusDuration,
//     ResetRetries: ResetRetries,
//     ConnectorPhaseRotation: ConnectorPhaseRotation,
//     StopTransactionOnEVSideDisconnect: StopTransactionOnEVSideDisconnect,
//     StopTransactionOnInvalidId: StopTransactionOnInvalidId,
//     StopTxnAlignedData: StopTxnAlignedData,
//     TransactionMessageAttempts: TransactionMessageAttempts,
//     TransactionMessageRetryInterval: TransactionMessageRetryInterval,
//     UnlockConnectorOnEVSideDisconnect: UnlockConnectorOnEVSideDisconnect,
//     WebSocketPingInterval: WebSocketPingInterval,
//      IdToken: IdToken,
//   });

//   pathname = "/configcp/changeconfiguration";
//   myurl = new URL(pathname, hostname);
//   var xhr = new XMLHttpRequest();
//   xhr.open("POST", myurl.href, true);
//   xhr.responseType = "text";
//   xhr.send(json);
//   alert("Configuration saved!!");
// }
