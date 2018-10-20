var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var urlschema = new Schema({

    media: { type: String },
    messageType: { type: String }

})

var Url = mongoose.model('Url', urlschema);

module.exports = Url;