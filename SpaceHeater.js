const Particle   = require('particle-api-js');
const { Client } = require('tplink-smarthome-api');
const config     = require('config');

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

    let temp = parseFloat(args[0]);
    if(!isNaN(temp)) {
      this.desiredTemp = temp;
    } else {
      this.desiredTemp = config.get('desiredTemp');
    }
    this.lowTemp              = this.desiredTemp - this.variance;
    console.log("Desired temperature: " + this.desiredTemp);

    this.getTemperature = this.getTemperature.bind(this);
    this.getTemperature();
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

    this.client.getDevice({host: this.plugAddress})
    .then(device => device.getSysInfo())
    .then(data => {
        var isOn = data.relay_state == 1;
        this.switchPower(tempF, isOn);
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
      setTimeout(this.getTemperature, this.interval);
    });
  }
}

new SpaceHeater(process.argv.slice(2));