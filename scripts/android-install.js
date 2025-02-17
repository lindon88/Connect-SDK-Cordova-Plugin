var exec = require('child_process').exec,
	path = require('path'),
	fs = require('fs'),
	http = require('http'),
	https = require('https'),
	isWin = /^win/.test(process.platform),
	Q = require('q'),
	csdkDirectory;

var commands = {
	rmRF: isWin ? "rmdir /S /Q" : "rm -rf",
	cp: isWin ? "copy" : "cp",
	mv: isWin ? "move" : "mv"
};

var paths = {
	"ConnectSDK_Repository": "https://github.com/boedy/Connect-SDK-Android.git",
	"ConnectSDK_Tag": "master",
};

function safePath(unsafePath) {
	return path.join(process.cwd(), "./platforms/android/", unsafePath);
}

function AndroidInstall() {}

AndroidInstall.prototype.steps = [
	"createTemporaryDirectory",
	"cloneConnectSDK",
	"cleanup"
];

AndroidInstall.prototype.start = function () {
	console.log("Starting ConnectSDK Android install");
	this.executeStep(0);
};

AndroidInstall.prototype.executeStep = function (step) {
	var self = this;
	if (step < this.steps.length) {
		var promise = this[this.steps[step]]();
		promise.then(function () {
			self.executeStep(step + 1);
		}, function (err) {
			console.log("Encountered an error, reverting install steps");
			console.error(err);
			self.revertStep(step);
		});
	} else {
		console.log("ConnectSDK Android install finished");
	}
};

AndroidInstall.prototype.revertStep = function (step) {
	var self = this;
	if (this.currentStep < this.steps.length) {
		var promise = this["revert_" + this.steps[step]]();
		promise.then(function () {
			self.revertStep(step - 1);
		}, function () {
			console.error("An error occured while reverting the install.");
		});
	} else {
		console.log("ConnectSDK Android install reverted");
	}
};

AndroidInstall.prototype.createTemporaryDirectory = function () {
	return Q.nfcall(fs.mkdir, safePath('./csdk_tmp'));
};

AndroidInstall.prototype.revert_createTemporaryDirectory = function () {
	return Q.nfcall(exec, commands.rmRF + " " + safePath("./csdk_tmp"));
};

AndroidInstall.prototype.cloneConnectSDK = function () {
	console.log("Cloning Connect-SDK-Android repository (" + paths.ConnectSDK_Tag + ")");
	return Q.nfcall(fs.readdir, safePath('./cordova-plugin-connectsdk'))
	.then(function (files) {
		for (var i = 0; i < files.length; i++) {
			if (files[i].indexOf('Connect-SDK-Android') !== -1) {
				csdkDirectory = files[i];
				return Q.nfcall(exec, commands.mv + " " + safePath("./cordova-plugin-connectsdk/" + csdkDirectory) + " " + safePath("./csdk_tmp/" + csdkDirectory));
			}
		}
	})
	.then(function () {
		return Q.nfcall(exec, "git clone --depth 1 " + paths.ConnectSDK_Repository + " " + safePath("./cordova-plugin-connectsdk/" + csdkDirectory));
	})
	.then(function () {
		return Q.nfcall(exec, "git checkout " + paths.ConnectSDK_Tag, {cwd: safePath("./cordova-plugin-connectsdk/" + csdkDirectory)});
	})
	.then(function () {
		return Q.nfcall(exec, "git submodule update --init", {cwd: safePath("./cordova-plugin-connectsdk/" + csdkDirectory)});
	})
	.then(function () {
		return Q.nfcall(exec, commands.cp + " " + safePath("../../plugins/cordova-plugin-connectsdk/Connect-SDK-Android/build.gradle") + " " + safePath("./cordova-plugin-connectsdk/" + csdkDirectory + "/build-extras.gradle"));
	})
	.then(function () {
		return Q.nfcall(exec, commands.cp + " " + safePath("./csdk_tmp/" + csdkDirectory + "/build.gradle") + " " + safePath("./cordova-plugin-connectsdk/" + csdkDirectory + "/build.gradle"));
	});
};

AndroidInstall.prototype.revert_cloneConnectSDK = function () {
	console.log("Reverting Connect-SDK-Android repository clone");
	return Q.nfcall(exec, commands.rmRF + " " + safePath('./cordova-plugin-connectsdk/' + csdkDirectory))
	.then (function () {
		return Q.nfcall(exec, commands.mv + " " + safePath("./csdk_tmp/" + csdkDirectory) + " " + safePath("./cordova-plugin-connectsdk/" + csdkDirectory));
	})
};

AndroidInstall.prototype.revert_downloadFlingSDK = function () {
	return Q.resolve();
};

AndroidInstall.prototype.cleanup = function () {
	console.log("Cleaning up");
	return this.revert_createTemporaryDirectory();
};

AndroidInstall.prototype.revert_cleanup = function () {
	return Q.resolve();
};

new AndroidInstall().start();
