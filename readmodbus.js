/* eslint-disable no-console, spaced-comment, func-call-spacing, no-spaced-func */

//==============================================================
// This is an example of polling (reading) Holding Registers
// on a regular scan interval with timeouts enabled.
// For robust behaviour, the next action is not activated
// until the previous action is completed (callback served).
//==============================================================

"use strict";

//==============================================================
// create an empty modbus client ACREL ADF400L (MULTI NODE KWH METER)
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
const mbsId       = 7;
const mbsScan     = 10000;
const mbsTimeout  = 10000;
let mbsState    = MBS_STATE_INIT;
let resnum ;
let num;
let voltage;
let current;
let power;
let pf;
let freq;
let energy;
let ctratio=4;
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
            mbsStatus = "Connected, wait for reading...";
            console.log(mbsStatus);
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_CONNECT;
            mbsStatus = e.message;
            console.log(e);
        });
};


//==============================================================
const readModbusData = function()
{
    // try to read data
    setTimeout(() => {
        client.readHoldingRegisters (0x033f, 2)//voltage
        .then(function(data)
        {
            mbsState   = MBS_STATE_GOOD_READ;
            mbsStatus  = "success";
            let tempnum = data.data[0] + data.data[1];
            voltage = convertNumber(tempnum);
            voltage=voltage/10;
            console.log("Voltage : " + voltage.toLocaleString() + " Volt");
            tempnum=0;
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_READ;
            mbsStatus = e.message;
            console.log(e);
        });    
    }, 200);
    setTimeout(() => {
        client.readHoldingRegisters (0x0342, 2)//current
        .then(function(data)
        {
            mbsState   = MBS_STATE_GOOD_READ;
            mbsStatus  = "success";
          //  console.log(data.data);
            let tempnum = data.data[0] + data.data[1];
            current = (convertNumber(tempnum) * ctratio)/100;
            console.log("Current : " + current.toLocaleString() + " A");
          
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_READ;
            mbsStatus = e.message;
            console.log(e);
        });    
    }, 1000);
    setTimeout(() => {
        client.readHoldingRegisters (0x0346, 2)//active power
        .then(function(data)
        {
            mbsState   = MBS_STATE_GOOD_READ;
            mbsStatus  = "success";
            //console.log(data.data);
          let tempnum= data.data[0] + data.data[1];

            power = (convertNumber(tempnum) * ctratio)/1000;
            console.log("Active power : " + power.toLocaleString() + " kW");
        
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_READ;
            mbsStatus = e.message;
            console.log(e);
        });    
    }, 2000);
    setTimeout(() => {
        client.readHoldingRegisters (0x034e, 2)//power factor
        .then(function(data)
        {
            mbsState   = MBS_STATE_GOOD_READ;
            mbsStatus  = "success";
            //console.log(data.data);
            let tempnum = data.data[0];
            pf=convertNumber(tempnum)/1000;
            console.log("Power factor : " + pf.toLocaleString());
            
        
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_READ;
            mbsStatus = e.message;
            console.log(e);
        });    
    }, 3000);
    setTimeout(() => {
        client.readHoldingRegisters (0x0352, 4)//active energy
        .then(function(data)
        {
            mbsState   = MBS_STATE_GOOD_READ;
            mbsStatus  = "success";
            let tempnum = data.data[0] + data.data[1] + data.data[2] + data.data[3];
             energy=(convertNumber(tempnum) * ctratio) / 100;
            console.log("Active Energy : "  + energy.toLocaleString() + " kwh");
          
        
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_READ;
            mbsStatus = e.message;
            console.log(e);
        });    
    }, 4000);
    setTimeout(() => {
        client.readHoldingRegisters (0x0351, 1)//frequency
        .then(function(data)
        {
            mbsState   = MBS_STATE_GOOD_READ;
            mbsStatus  = "success";
            freq = convertNumber(data.data) /100;
            console.log("Frequency : " + freq.toLocaleString());
            
        
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_READ;
            mbsStatus = e.message;
            console.log(e);
        });    
    }, 5000);
    
};


//==============================================================
const runModbus = function()
{
    let nextAction;

    switch (mbsState)
    {
        case MBS_STATE_INIT:
            nextAction = connectClient;
            break;

        case MBS_STATE_NEXT:
            nextAction = readModbusData;
            break;

        case MBS_STATE_GOOD_CONNECT:
            nextAction = readModbusData;
            break;

        case MBS_STATE_FAIL_CONNECT:
            nextAction = connectClient;
            break;

        case MBS_STATE_GOOD_READ:
            nextAction = readModbusData;
            break;

        case MBS_STATE_FAIL_READ:
            if (client.isOpen)  { mbsState = MBS_STATE_NEXT;  }
            else                { nextAction = connectClient; }
            break;

        default:
            // nothing to do, keep scanning until actionable case
    }

    console.log();
    console.log(nextAction);

    // execute "next action" function if defined
    if (nextAction !== undefined)
    {
        nextAction();
        mbsState = MBS_STATE_IDLE;
    }

    // set for next run
    setTimeout (runModbus, mbsScan);
};
function convertNumber(num){
    if(num>32768)
    {
        resnum = 65536-num;
    }
    else{
        resnum = num;
    }
    return resnum;
}
//==============================================================
runModbus();
   
