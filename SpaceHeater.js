const Particle   = require('particle-api-js');
const { Client } = require('tplink-smarthome-api');
const config     = require('config');
const http = require('http');
const WebSocketServer = require('websocket').server;

class SpaceHeater {
  constructor(args) {
    this.particle             = new Particle();
    this.client               = new Client();
    this.token                = config.get('Particle.token');
    this.deviceId             = config.get('Particle.deviceId');
    this.particleVariableName = config.get('Particle.particleVariableName');
    this.plugAddress          = config.get('Plug.plugAddress');
    this.interval             = config.get('sampleFrequencyMs'); 
    this.variance             = config.get('temperatureVariance');
    this.websocketPort        = config.get('websocketPort');
    this.temperatureHistory   = [];
    this.server               = http.createServer();
    this.spaceHeaterStatus    = {};
    this.powerState = false;

    let temp = parseFloat(args[0]);
    if(!isNaN(temp)) {
      this.desiredTemp = temp;
    } else {
      this.desiredTemp = config.get('desiredTemp');
    }
    this.lowTemp              = this.desiredTemp - this.variance;
    console.log("Desired temperature: " + this.desiredTemp);
    
    this.spaceHeaterStatus.desiredTemp = this.desiredTemp;
    this.spaceHeaterStatus.lowTemp = this.lowTemp;

    this.getTemperature = this.getTemperature.bind(this);

    this.initializeWebsocketServer();
    this.getTemperature();
  }

  initializeWebsocketServer() {
    let that = this;
    this.server.listen(this.websocketPort);
    const wsServer = new WebSocketServer({
      httpServer: this.server
    });

    wsServer.on('request', function(request) {
      const connection = request.accept(null, request.origin);
      connection.on('message', function(message) {
        console.log('Received Message:', message.utf8Data);
        connection.send(JSON.stringify(that.getSpaceHeaterStatus()));;
      });
      connection.on('close', function(reasonCode, description) {
        console.log('Client has disconnected.');
      });
    });
  }

  getTemperature() {
    let opts = { 
      deviceId: this.deviceId, 
      name:     this.particleVariableName, 
      auth:     this.token 
    };
    let that = this;

    that.particle.getVariable(opts)
    .then(data => {that.checkTemp(data.body.result)})
    .catch(err => {
      console.log('An error occurred while getting attrs:', err);
      setTimeout(that.getTemperature, that.interval);
    });
  }

  checkTemp(tempC) {
    var tempF = Number.parseFloat((tempC * (9/5)) + 32).toFixed(1);
    this.recordTemperature(tempF);
    // The temp sensor is a bit "shakey"
    let rollingAvg = this.spaceHeaterStatus.rollingAvgTempF;

    this.client.getDevice({host: this.plugAddress})
    .then(device => device.getSysInfo())
    .then(data => {
        var isOn = data.relay_state == 1;
        this.switchPower(rollingAvg, isOn);
      });
  }

  switchPower(tempF, isOn) {
    console.log(`temp (F): ${tempF}, power on: ${isOn}, low: ${this.lowTemp}, hi: ${this.desiredTemp}`);
    if((tempF >= this.desiredTemp) && isOn) {
      this.togglePower(false);
    } else if((tempF <= this.lowTemp) && !isOn) {
      this.togglePower(true);
    } else {
      setTimeout(this.getTemperature, this.interval);
    }
  }

  /**
  * powerState - off = false, on = true
  */
  togglePower(powerState) {
    console.log("setting power " + (powerState ? "on" : "off"));
    this.client.getDevice({host: this.plugAddress}).then((device) => {
      device.setPowerState(powerState);
      this.spaceHeaterStatus.powerState = powerState;
      setTimeout(this.getTemperature, this.interval);
    });
  }

  getSpaceHeaterStatus() {
    return this.spaceHeaterStatus;
  }

  recordTemperature(tempF) {
    var samples = 6;
    this.spaceHeaterStatus.tempF = tempF;
    this.temperatureHistory.push(tempF);
    while(this.temperatureHistory.length > samples) {
      this.temperatureHistory.shift();
    }
    var total = 0;
    for(var i = 0; i < this.temperatureHistory.length; i++) {
        total += parseFloat(this.temperatureHistory[i]);
    }
    this.spaceHeaterStatus.rollingAvgTempF = (total / this.temperatureHistory.length).toFixed(1);
  }
}

new SpaceHeater(process.argv.slice(2));