var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var mongoosePaginate = require('mongoose-paginate');
var chatSchema = new Schema({


    senderId: {
        type: String
    },
    senderImage:{
        type:String
    },
    senderName: {
        type: String
    },
    receiverId: {
        type: String
    },
    receiverImage:{
        type:String
    },
    roomId: {
        type: String
    },

    messageType: {
        type: String
    },
    mediaType: {
        type: String
    },
    media: {
        type: String
    },

    message: {
        type: String
    },

    timeStamp: {
        type:String,
        default: new Date().getTime()
    },
    status: {
        type: String,
        default: 'SENT'
    },
    hidden: {
        type: [String]
    },
    isEncrypted:{
        type:Boolean,
        default:true
    }
});

chatSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('chatHistory', chatSchema);
