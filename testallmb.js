const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();
const portRTU = "COM7";
const IDRelay = 1; //id device relay wavesharee
const IDMeter = 7; //id device kwh meter acrel

client
  .connectRTUBuffered(`${portRTU}`, {
    baudRate: 9600,
    parity: "none",
    dataBits: 8,
    stopBits: 1,
  })
  .then(connectModbus)
  //  .then(turnRelayOn(0x01,5000))
  // .then(turnRelayOff(0x01,5000))
  //.then(close)
  .then(function () {
    console.log("Connected to modbus");
  })
  .catch(function (e) {
    console.log(e);
  });
function connectModbus() {
  client.setID(1);
  // client.setTimeout(1000);
  //    setTimeout(() => {
  //     allRelayOff();

  //    }, 1000);

  setTimeout(() => {
    turnRelayOn(0x02);
  }, 200);
  setTimeout(() => {
    client.setID(7);
    setTimeout(() => {
      client
        .readHoldingRegisters(0x033f, 1)
        .then(function (data) {
          console.log(parseFloat(data.data));
        })
        .catch(function (e) {
          console.log(e);
        });
    }, 4000);
  }, 2000);
}

function turnRelayOn(address) {
  if (client) {
    client.writeCoil(address, 0xff00);
  }
}
function turnRelayOff(address) {
  if (client) {
    client.writeCoil(address, 0x0000);
  }
}
function allRelayOff() {
  if (client) {
    for (let j = 0; j < 8; j++) {
      setTimeout(() => {
        turnRelayOff(j);
      }, 2000 * j);
    }
  }
}

function allRelayOn() {
  if (client) {
    for (let j = 0; j < 8; j++) {
      setTimeout(() => {
        turnRelayOn(j);
      }, 2000 * j);
    }
  }
}

function close() {
  client.close();
}
