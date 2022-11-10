About
===
This project is a massively wasteful thermostat that ties together a Particle WiFi device and a TP Link Wifi plug.
The code assumes you have a temperature sensor (TMP36) on an analog GPIO connected to the Particle device and any sort of space heater attached to the plug.  

Installation
===
	
	# add auth info for your Particle device and address for the TP Link plug
	cp config/default.json.example config/default.json

	# install dependencies 
    npm install

Running the app
===

    node SpaceHeater.js [TEMP_FARENHEIT]