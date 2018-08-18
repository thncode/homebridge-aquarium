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
    this.interval = Math.min(Math.max(config.interval, 1), 600);

    this.config = config;

	url = "http://192.168.178.21/sensors.html";

    // Setup services
    this.setUpServices();
        
	read();

	setInterval(function() {
					
		if (true) {
			
			read();
			
			that.log("pH Wert: " + ph + " Temperatur: " + temp + " Leakage: " + niveau);

			that.fakeGatoHistoryService.addEntry({
				time: new Date().getTime() / 1000,
				temp: temp,
				pressure: ph * 1000
				});
		}
	}, 60000); // ev 1 min
	
}


AquariumPlugin.prototype.getFirmwareRevision = function (callback) {
    callback(null, '0.0.0');
};

AquariumPlugin.prototype.getBatteryLevel = function (callback) {
    callback(null, 100);
};

AquariumPlugin.prototype.getStatusActive = function (callback) {
    callback(null, true);
};

AquariumPlugin.prototype.getStatusLowBattery = function (callback) {
    callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
};

AquariumPlugin.prototype.getStatusLeak = function (callback) {
    callback(null, true ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
 };

AquariumPlugin.prototype.getCurrentTemperature = function (callback) {
    callback(null, temp);
};

AquariumPlugin.prototype.getCurrentMoisture = function (callback) {
    callback(null, ph * 1000);
};

AquariumPlugin.prototype.setUpServices = function () {
    // info service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, this.config.manufacturer)
        .setCharacteristic(Characteristic.Model, this.config.model || "Aquarium")
        .setCharacteristic(Characteristic.SerialNumber, this.config.serial || hostname + "-" + this.name);
    this.informationService.getCharacteristic(Characteristic.FirmwareRevision)
        .on('get', this.getFirmwareRevision.bind(this));
    this.batteryService = new Service.BatteryService(this.name);
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevel.bind(this));
    this.batteryService.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGEABLE);
    this.batteryService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));

    this.tempService = new Service.TemperatureSensor("Temperatur");
    this.tempService.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    if (true) {
        this.humidityAlertService = new Service.ContactSensor(this.name + " leak detected", "leak");
        this.humidityAlertService.getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getStatusLeak.bind(this));
        this.humidityAlertService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getStatusLowBattery.bind(this));
        this.humidityAlertService.getCharacteristic(Characteristic.StatusActive)
            .on('get', this.getStatusActive.bind(this));
    }

    this.fakeGatoHistoryService = new FakeGatoHistoryService("room", this, { storage: 'fs' });

    /*
        own characteristics and services
    */

    // pH characteristic
    SoilMoisture = function () {
        Characteristic.call(this, 'Soil Moisture', 'E863F10F-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: "pH",
            maxValue: 9000,
            minValue: 0,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(SoilMoisture, Characteristic);

    SoilMoisture.UUID = 'E863F10F-079E-48FF-8F27-9C2605A29F52';



    // aquarium sensor
    AquaSensor = function (displayName, subtype) {
        Service.call(this, displayName, '3C233958-B5C4-4218-A0CD-60B8B971AA0A', subtype);

        // Required Characteristics
        this.addCharacteristic(SoilMoisture);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.CurrentTemperature);
    };

    inherits(AquaSensor, Service);

    AquaSensor.UUID = '3C233958-B5C4-4218-A0CD-60B8B971AA0A';

    this.aquaSensorService = new AquaSensor(this.name);
    this.aquaSensorService.getCharacteristic(SoilMoisture)
        .on('get', this.getCurrentMoisture.bind(this));
    this.aquaSensorService.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));
    this.aquaSensorService.getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.getStatusLeak.bind(this));
};


AquariumPlugin.prototype.getServices = function () {
    var services = [this.informationService, 
					this.batteryService, 
					this.aquaSensorService, 
					this.fakeGatoHistoryService];

    return services;
};
