var Service, Characteristic, HomebridgeAPI, FakeGatoHistoryService;
var inherits = require('util').inherits;
var os = require("os");
var hostname = os.hostname();
var request = require("request");

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory("homebridge-aquarium", "Aquarium", AquariumPlugin);
};


var ph;
var temp;
var niveau;
var url;
var body;
var minTemp, maxTemp;
var minpH, maxpH;


function read() {
	
    request(url, function (error, response, body) {
		var pos = body.indexOf("pH-Wert 1");
		var str = body.substr(pos + 145, 6);
		for (i = 0; i < 6; i++)
			if (str[i] != ' ') break;
		if (i) str = str.substr(i);
		ph = parseFloat(str);
		
		pos = body.indexOf("Temperatur 1");
		str = body.substr(pos + 149, 8);
		for (i = 0; i < 8; i++)
			if (str[i] != ' ') break;
		if (i) str = str.substr(i);
		temp = parseFloat(str);

		pos = body.indexOf("Niveauregelung 1");
		niveau = body.substr(pos + 118, 3);
	});
} 


function AquariumPlugin(log, config) {
    var that = this;
    this.log = log;
    this.name = config.name;
    this.displayName = this.name;
    this.deviceId = config.deviceId;

    this.config = config;

	url = config['url'];
	
	minTemp = config['minTemp'];
	maxTemp = config['maxTemp'];
	minpH = config['minpH'];
	maxpH = config['maxpH'];

    // Setup services
    this.setUpServices();
        
	read();

	setInterval(function() {
					
		if (true) {
			
			read();
			
			var leakage = niveau == "+ 2" ? "" : " Leakage!"
			that.log("pH Wert: " + ph + " Temperatur: " + temp + leakage);

			that.fakeGatoHistoryService.addEntry({
				time: new Date().getTime() / 1000,
				temp: temp,
				pressure: ph * 100
				});
		}
	}, 60000); // ev 1 min
	
}


AquariumPlugin.prototype.getFirmwareRevision = function (callback) {
    callback(null, '1.0.0');
};

AquariumPlugin.prototype.getStatusActive = function (callback) {
    callback(null, true);
};

AquariumPlugin.prototype.getStatusLimit = function (callback) {
	var limit = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
	if (temp < minTemp || temp > maxTemp || ph < minpH || ph > maxpH) limit = Characteristic.ContactSensorState.CONTACT_DETECTED;
    callback(null, limit);
 };

AquariumPlugin.prototype.getStatusLeak = function (callback) {
	var leak = Characteristic.LeakDetected.CONTACT_NOT_DETECTED;
	if (niveau != "+ 2") leak = Characteristic.LeakDetected.CONTACT_DETECTED;
    callback(null, leak);
 };

AquariumPlugin.prototype.getCurrentTemperature = function (callback) {
    callback(null, temp);
};

AquariumPlugin.prototype.getCurrentHardness = function (callback) {
    callback(null, ph * 100);
};

AquariumPlugin.prototype.setUpServices = function () {
    // info service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, "Thomas Nemec")
        .setCharacteristic(Characteristic.Model, this.config.model || "Aquarium")
        .setCharacteristic(Characteristic.SerialNumber, this.config.serial || hostname + "-" + this.name);
    this.informationService.getCharacteristic(Characteristic.FirmwareRevision)
        .on('get', this.getFirmwareRevision.bind(this));

    this.tempService = new Service.TemperatureSensor("Temperatur");
    this.tempService.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

	this.limitAlertService = new Service.ContactSensor(this.name + " Limit", "limit");
	this.limitAlertService.getCharacteristic(Characteristic.ContactSensorState)
		.on('get', this.getStatusLimit.bind(this));
	this.limitAlertService.getCharacteristic(Characteristic.StatusActive)
		.on('get', this.getStatusActive.bind(this));

	this.leakAlertService = new Service.LeakSensor(this.name + " Leck", "leak");
	this.leakAlertService.getCharacteristic(Characteristic.LeakDetected)
		.on('get', this.getStatusLeak.bind(this));
	this.leakAlertService.getCharacteristic(Characteristic.StatusActive)
		.on('get', this.getStatusActive.bind(this));

    this.fakeGatoHistoryService = new FakeGatoHistoryService("weather", this, { storage: 'fs' });

    /*
        own characteristics and services
    */

    // pH characteristic
    pHvalue = function () {
        Characteristic.call(this, 'pH', 'E863F10F-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: "pH",
            maxValue: 1100,
            minValue: 600,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(pHvalue, Characteristic);

    pHvalue.UUID = 'E863F10F-079E-48FF-8F27-9C2605A29F52';



    // aquarium sensor
    AquaSensor = function (displayName, subtype) {
        Service.call(this, displayName, '3C233958-B5C4-4218-A0CD-60B8B971AA0A', subtype);

        // Required Characteristics
        this.addCharacteristic(pHvalue);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.CurrentTemperature);
    };

    inherits(AquaSensor, Service);

    AquaSensor.UUID = '3C233958-B5C4-4218-A0CD-60B8B971AA0A';

    this.aquaSensorService = new AquaSensor(this.name);
    this.aquaSensorService.getCharacteristic(pHvalue)
        .on('get', this.getCurrentHardness.bind(this));
    this.aquaSensorService.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));
    //this.aquaSensorService.getCharacteristic(Characteristic.ContactSensorState)
    //    .on('get', this.getStatusLimit.bind(this));
};


AquariumPlugin.prototype.getServices = function () {
    var services = [this.informationService, 
					this.aquaSensorService, 
					this.limitAlertService, 
					this.leakAlertService, 
					this.fakeGatoHistoryService];

    return services;
};
