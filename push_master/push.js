var apn = require("apn"),
options, connection, notification;
var FCM = require('fcm').FCM;

var options1 = {
"cert": "apns-production-76c9e69bff.pem",
"key": "apns-production-76c9e69bff.pem",
"passphrase": "wish", //Acropole
"gateway": "gateway.push.apple.com",
"port": 2195,
"enhanced": true,
"cacheLength": 5
};

var options2 = {
"cert": "wishalertdistribution22.pem",
"key": "wishalertdistribution22.pem",
"passphrase": "bizz", //Acropole
"gateway": "gateway.push.apple.com",
"port": 2195,
"enhanced": true,
"cacheLength": 5
};

var devOptions =  {
    "cert": "MobiloittedevntestingDevelop.pem",
    "key": "MobiloittedevntestingDevelop.pem",
    "passphrase": "Mobiloitte1", //Acropole
    "gateway": "gateway.sandbox.push.apple.com",
    "port": 2195,
    "enhanced": true,
    "cacheLength": 5
}

    function iosPush (token, data,options) {
    //console.log("data", data.type);
	 console.log("push data ____++++++_____>>>>>>>>", data);
    data['aps'] = { 'mutable-content' : 1, custom_type: "message_received" };
     // if(data.media){
     //    data.aps['mutable-content'] = 1
     // }else{
     //    data.aps['mutable-content'] = 0
     // }

    var deviceToken = token;
    //console.log("deviceToken", deviceToken)
    try {
    var apnConnection = new apn.Connection(options);
    var myDevice = new apn.Device(deviceToken);
    //var myDevice = [deviceToken]
    var note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
    note.badge = data.badgeCount;
    note.sound = "ping.aiff";
    note.alert = "New message from "+data.senderName+" :\n"+data.message;
    //note["mutable-content"] = 1;
    note.payload = data
    //console.log("note==>>>", note)
    /*{
                            "receiverImage":data.receiverImage,
                            "otheruserid": data.senderId,
                            "type": data.type,
                            "userName":data.senderName
                        };*/
    
        apnConnection.pushNotification(note, myDevice); //devicIos
        apnConnection.on('transmitted', function (notification, deviceToken) {
            console.log('APNS: Successfully transmitted message' + JSON.stringify(notification));
        });

    } catch (ex) {
        //console.log("in Error");
        console.log(ex);
    }
    //  console.log('iOS Push Notification send');

};

function decryptMessage(text) {
    
  console.log("________MAIN TEXT_________",text);

  var crypto = require('crypto'),
  ENCRYPTION_KEY = '9D7A7A5F8A49DBD4761D1DB999CC9323'

  var textParts = text.split(':');
  console.log("________textParts+++++++++",textParts);

  var iv = new Buffer(textParts.shift(), 'hex');
  console.log("________iv=======>>>>",iv);
  var encryptedText = new Buffer(textParts.join(':'), 'hex');

  console.log("________encryptedText ************ ",encryptedText);
  

  var decipher = crypto.createDecipheriv('aes-256-cbc', new Buffer(ENCRYPTION_KEY), iv);
  console.log("________decipher___%%%%%%%% ",decipher);

  var decrypted = decipher.update(encryptedText);
 console.log("________decrypted___@@@@@ ",decrypted);

  decrypted = Buffer.concat([decrypted, decipher.final()]);
  console.log("decrypted message"+decrypted.toString());
  return decrypted.toString()
}

module.exports = {
options1,
options2,
devOptions,
iosPush,
decryptMessage
}

