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


  httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
    request({
      url: url,
      body: body,
      method: method,
      auth: {
        user: username,
        pass: password,
        sendImmediately: sendimmediately
      }
    },
    function(error, response, body) {
      callback(error, response, body)
    })
  };


function AquariumPlugin(log, config) {
    var that = this;
    this.log = log;
    this.name = config.name;
    this.displayName = this.name;
    this.deviceId = config.deviceId;
    this.interval = Math.min(Math.max(config.interval, 1), 600);

    this.config = config;

    this.storedData = {};

    if (config.humidityAlertLevel != null) {
        this.humidityAlert = true;
        this.humidityAlertLevel = config.humidityAlertLevel;
    } else {
        this.humidityAlert = false;
    }

    if (config.lowLightAlertLevel != null) {
        this.lowLightAlert = true;
        this.lowLightAlertLevel = config.lowLightAlertLevel;
    } else {
        this.lowLightAlert = false;
    }

    // Setup services
    this.setUpServices();
    
    var url = "http://192.168.178.21/sensors.html";
    var body;
    
    this.httpRequest(url, body, "POST", "thomas", "", "sendimmediately", function(error, response, responseBody) {
      if (error) {
        this.log('HTTP function failed: %s', error.message);
        callback(error);
      } else {
        this.log('HTTP function succeeded!');
        this.log(response);
        this.log(responseBody);
        callback();
      }
}


AquariumPlugin.prototype.getFirmwareRevision = function (callback) {
    callback(null, this.storedData.firmware ? this.storedData.firmware.firmwareVersion : '0.0.0');
};

AquariumPlugin.prototype.getBatteryLevel = function (callback) {
    callback(null, this.storedData.firmware ? this.storedData.firmware.batteryLevel : 0);
};

AquariumPlugin.prototype.getStatusActive = function (callback) {
    callback(null, this.storedData.data ? true : false);
};

AquariumPlugin.prototype.getStatusLowBattery = function (callback) {
    if (this.storedData.firmware) {
        callback(null, this.storedData.firmware.batteryLevel <= 20 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    } else {
        callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }
};

AquariumPlugin.prototype.getStatusLowMoisture = function (callback) {
    if (this.storedData.data) {
        callback(null, this.storedData.data.moisture <= this.humidityAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
    } else {
        callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
};

AquariumPlugin.prototype.getStatusLowLight = function (callback) {
    if (this.storedData.data) {
        callback(null, this.storedData.data.lux <= this.lowLightAlertLevel ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
    } else {
        callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
};

AquariumPlugin.prototype.getCurrentAmbientLightLevel = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.lux : 0);
};

AquariumPlugin.prototype.getCurrentTemperature = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.temperature : 0);
};

AquariumPlugin.prototype.getCurrentMoisture = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.moisture : 0);
};

AquariumPlugin.prototype.getCurrentFertility = function (callback) {
    callback(null, this.storedData.data ? this.storedData.data.fertility : 0);
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

    this.lightService = new Service.LightSensor(this.name);
    this.lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getCurrentAmbientLightLevel.bind(this));
    this.lightService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.lightService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    this.tempService = new Service.TemperatureSensor(this.name);
    this.tempService.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    this.humidityService = new Service.HumiditySensor(this.name);
    this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getCurrentMoisture.bind(this));
    this.humidityService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.humidityService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    if (this.humidityAlert) {
        this.humidityAlertService = new Service.ContactSensor(this.name + " Low Humidity", "humidity");
        this.humidityAlertService.getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getStatusLowMoisture.bind(this));
        this.humidityAlertService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getStatusLowBattery.bind(this));
        this.humidityAlertService.getCharacteristic(Characteristic.StatusActive)
            .on('get', this.getStatusActive.bind(this));
    }

    if (this.lowLightAlert) {
        this.lowLightAlertService = new Service.ContactSensor(this.name + " Low Light", "light");
        this.lowLightAlertService.getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getStatusLowLight.bind(this));
        this.lowLightAlertService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', this.getStatusLowBattery.bind(this));
        this.lowLightAlertService.getCharacteristic(Characteristic.StatusActive)
            .on('get', this.getStatusActive.bind(this));
    }

    this.fakeGatoHistoryService = new FakeGatoHistoryService("room", this, { storage: 'fs' });

    /*
        own characteristics and services
    */

    // moisture characteristic
    SoilMoisture = function () {
        Characteristic.call(this, 'Soil Moisture', 'C160D589-9510-4432-BAA6-5D9D77957138');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            unit: Characteristic.Units.PERCENTAGE,
            maxValue: 100,
            minValue: 0,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(SoilMoisture, Characteristic);

    SoilMoisture.UUID = 'C160D589-9510-4432-BAA6-5D9D77957138';


    // fertility characteristic
    SoilFertility = function () {
        Characteristic.call(this, 'Soil Fertility', '0029260E-B09C-4FD7-9E60-2C60F1250618');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            maxValue: 10000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(SoilFertility, Characteristic);

    SoilFertility.UUID = '0029260E-B09C-4FD7-9E60-2C60F1250618';


    // moisture sensor
    PlantSensor = function (displayName, subtype) {
        Service.call(this, displayName, '3C233958-B5C4-4218-A0CD-60B8B971AA0A', subtype);

        // Required Characteristics
        this.addCharacteristic(SoilMoisture);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.CurrentTemperature);
        this.addOptionalCharacteristic(SoilFertility);
    };

    inherits(PlantSensor, Service);

    PlantSensor.UUID = '3C233958-B5C4-4218-A0CD-60B8B971AA0A';


    this.plantSensorService = new PlantSensor(this.name);
    this.plantSensorService.getCharacteristic(SoilMoisture)
        .on('get', this.getCurrentMoisture.bind(this));
    this.plantSensorService.getCharacteristic(SoilFertility)
        .on('get', this.getCurrentFertility.bind(this));
};


AquariumPlugin.prototype.getServices = function () {
    var services = [this.informationService, this.batteryService, this.lightService, this.tempService, this.humidityService, this.plantSensorService, this.fakeGatoHistoryService];
    if (this.humidityAlert) {
        services[services.length] = this.humidityAlertService;
    }
    if (this.lowLightAlert) {
        services[services.length] = this.lowLightAlertService;
    }
    return services;
};
