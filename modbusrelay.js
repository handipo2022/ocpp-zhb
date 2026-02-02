/* eslint-disable no-console, spaced-comment, func-call-spacing, no-spaced-func */

//==============================================================
// This is an example of polling (reading) Holding Registers
// on a regular scan interval with timeouts enabled.
// For robust behaviour, the next action is not activated
// until the previous action is completed (callback served).
//==============================================================

"use strict";

//==============================================================
// create an empty modbus client WAVESHARE MODBUS RTU RELAY 8 CHANNEL
const ModbusRTU   = require ("modbus-serial");
const client      = new ModbusRTU();
const portRTU     = "COM3";


let mbsStatus   = "Initializing...";    // holds a status of Modbus

// Modbus 'state' constants
const MBS_STATE_INIT          = "State init";
const MBS_STATE_IDLE          = "State idle";
const MBS_STATE_NEXT          = "State next";
const MBS_STATE_GOOD_READ     = "State good (read)";
const MBS_STATE_FAIL_READ     = "State fail (read)";
const MBS_STATE_GOOD_CONNECT  = "State good (port)";
const MBS_STATE_FAIL_CONNECT  = "State fail (port)";

// Modbus configuration values
const mbsId       = 1;
const mbsScan     = 1000;
const mbsTimeout  = 5000;
let mbsState    = MBS_STATE_INIT;

// Upon SerialPort error
client.on("error", function(error) {
    console.log("SerialPort Error: ", error);
});



//==============================================================
const connectClient = function()
{
    // set requests parameters
    client.setID      (mbsId);
    client.setTimeout (mbsTimeout);

    // try to connect
    client.connectRTUBuffered (`${portRTU}`, { baudRate: 9600, parity: "none", dataBits: 8, stopBits: 1 })
        .then(function()
        {
            mbsState  = MBS_STATE_GOOD_CONNECT;
            mbsStatus = "Connected, wait for writing...";
            console.log(mbsStatus);
            setTimeout(() => {
         //     turnRelayOn(0x03);
          //    turnRelayOn(0x04);
              
           allRelayOn();  
            }, 50);

            setTimeout(() => {
          //    turnRelayOff(0x03);
            //  turnRelayOff(0x04);
             allRelayOff();  
            }, 25000);
            
            
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_CONNECT;
            mbsStatus = e.message;
            console.log(e);
        });
};

function turnRelayOn(address){
  if(client){
    client.writeCoil(address,0xff00)
  }


}
function turnRelayOff(address){
  if(client){
    client.writeCoil(address,0x0000)
  }
}
function allRelayOff(){
  if(client){
    for(let j=0;j<8;j++){
      setTimeout(() => {
        turnRelayOff(j);
      }, 2000*j);
    }
  }
}

function allRelayOn(){
  if(client){
    for(let j=0;j<8;j++){
      setTimeout(() => {
        turnRelayOn(j);
      }, 2000*j);
    }
  }
}

   
connectClient();

