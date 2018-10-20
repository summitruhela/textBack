var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var mongoose = require('mongoose');


const translate = require('google-translate-api');
var waterfall = require('async-waterfall');
var chatHistory = require('./db_repo/chatHistory.js');
var Room = require('./db_repo/room.js');
var User = require('./db_repo/chatUser.js');
var urlMedia = require('./db_repo/chatUrl.js');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var bodyParser = require('body-parser');
var request = require('request');
var async = require('async');
var cloudinary = require('cloudinary')
var multiparty = require('multiparty')
var notify = require('./push_master/push.js');
app.use(bodyParser.json())
cloudinary.config({
  cloud_name: "sumit9211",
  api_key: "885582783668825",
  api_secret: "0dT6FoxdcGb7UjTKtUGQbAVdOJI"
});

//var config = require('./config');

mongoose.Promise = global.Promise;
mongoose.connect("mongodb://localhost/textback", { useMongoClient: true });

/*Access-Control-Allow-Headers*/
app.use(bodyParser.urlencoded({
  limit: "50mb",
  extended: true,
  parameterLimit: 50000
}));


app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});
app.get('/', (req, res) => {
  /*var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;*/
  var message = "Please Use the following URL for connect socket " + req.protocol + '://' + req.get('host') + req.originalUrl
  res.send(message)
})


var sockets = {};
var onlineUsers = {};


io.sockets.on('connection', function (socket) {

  console.log("\x1b[31m", "Congratulation connection has been established");

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  socket.on('initChat', function (data) {
    User.findOne({
      userId: data.userId
    }, function (err, result) {
      // console.log("result data of init chat--->"+result);
      if (result == null || result == "" || result == undefined) {
        var user = new User(data);
        user.save(function (err) {
          if (err) return err;
        })
      } else {
        User.update({
          userId: data.userId
        }, {
            $set: {

              deviceToken: data.deviceToken,
              profilePic: data.profilePic,
              profilePicFull: data.profilePicFull,
              userName: data.userName
            }
          }, function (err, results) {
            if (err) return err;
            //console.log("initChat>>>>", results);

          });
      }
    })
    sockets[socket.id] = {
      data: data,
      socket: socket
    };
    console.log("sockets", sockets);
    if (!(data.userId in onlineUsers)) {
      onlineUsers[data.userId] = {
        socketId: [socket.id],
        userId: data.userId,
        userName: data.userName,
        status: "online"

      };
    } else {
      onlineUsers[data.userId].socketId.push(socket.id)
    }
    console.log("sockets1111111111111============>", sockets);
    console.log("onlineUsers", onlineUsers);
    //onlineUsers[data.userId]= {socketId:[socket.id],userId:data.userId, userName: data.userName, status:"online"};
    socket.broadcast.emit('userIsOnline', { userId: data.userId })
  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  socket.on('logout', function (data) {
    console.log("initChat created....." + JSON.stringify(data));
    User.findOne({
      userId: data.userId
    }, function (err, result) {
      // console.log("result data of init chat--->"+result);
      if (result == null || result == "" || result == undefined) {
        var user = new User(data);
        user.save(function (err) {
          if (err) return err;
        })
      } else {
        User.update({
          userId: data.userId
        }, {
            $set: {
              deviceToken: null,
            }
          }, function (err, results) {
            if (err) return err;
            // console.log("logout>>>>", results);

          });
      }
    })

    //onlineUsers[data.userId]= {socketId:[socket.id],userId:data.userId, userName: data.userName, status:"online"};

    //console.log('Online Users---->' + JSON.stringify(onlineUsers));

  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  //----------------------------------------User Status---------------------------------------------------------------//
  socket.on('userStatus', function (data) { //userId and status
    console.log("userStatus  data---- ", JSON.stringify(data));
    if (onlineUsers[data.userId] == undefined) {
      //console.log("user is offline");
    } else {
      var members = [];
      onlineUsers[data.userId].status = data.status;
      socket.broadcast.emit(data.userId + " is " + data.status);
      //console.log("User status----", JSON.stringify(onlineUsers[data.userId]));
    }
  });


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  //---------------------------------------------Online User ----------------------------------------------------------//
  socket.on('isOnline', function (data) { //userId and receiverId
    //console.log("isOnline data-------" + JSON.stringify(data));
    var userStatus;
    if (onlineUsers[data.receiverId] == undefined) {
      userStatus = "Offline";
    } else {
      userStatus = onlineUsers[data.receiverId].status;
    }

    if (onlineUsers[data.userId] == undefined) {
      //console.log("sender is offline")

    } else {
      sockets[onlineUsers[data.userId].socketId].socket.emit('onlineStatus', userStatus);
    }
  });


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  //------------------------------------------ Send Message -----------------------------------------------------//  
  socket.on('sendmessage', function (data) {
    console.log("data entry is ==============================>",data);
    var receiveImage = "";
    var timeStamp = new Date().getTime();
    var utcDate = new Date().getTime();
    var participants = [data.receiverId, data.senderId]

    var query = {
      activeUsers: {
        $all: participants
      }
    }
    waterfall([
      function (callback) {
        User.findOne({
          userId: data.receiverId
        }, (err, user) => {
          //console.log("new user", user)
          if (!user == null) {
            new User({
              userId: data.receiverId,
              userName: data.receiverName,
              profilePic: data.receiverProfilePic,
              profilePicFull: data.recieverprofilePicFull,
              blockedUsers: []
            }).save((err, success) => {
              //console.log("user saved", success, err)
              callback()
            })
          }
          else
            callback()
        })
      },
      function (callback) {
        Room.findOne(query, function (err, result) {
          //console.log("active user====>>"+JSON.stringify(result))
          if (result == null || result == "" || result == undefined) {
            var addParticipents = []

            for (var i = 0; i < participants.length; i++) {
              addParticipents.push({
                userId: participants[i]
              })
            }
            var room = new Room({
              activeUsers: participants,
              participants: addParticipents,
              chatType: "single"
            });
            room.save(function (err, roomResult) {
              //console.log("Room saved",roomResult);
              if (err) {
                //console.log("Something went wrong in room creation", err)
              } else {
                //console.log("New created roomId is"+roomResult._id)
                callback(null, roomResult._id)
              }
            })
          } else {
            //console.log("existing roomID "+result._id)
            callback(null, result._id)
          }
        })
      },
      function (roomId1, callback) {
        console.log("callback=========>", data["media"], typeof data);
        User.find({
          userId: {
            $in: [data.receiverId, data.senderId]
          }
        }, function (err, result) {
          console.log("results===>", result[0]);

          //console.log("data", result[0].blockedUsers.indexOf(data.senderId), result[1].blockedUsers.indexOf(data.receiverId),result[0].userId,data.receiverId)
          if (result[0].userId == data.receiverId) {
            if (result[0].blockedUsers.indexOf(data.senderId) >= 0 || result[1].blockedUsers.indexOf(data.receiverId) >= 0) { } else {

              var roomId = roomId1
              //console.log("======>>>Room id is",roomId);
              //console.log("data for chat history1111111111111>>>", data)
              if (onlineUsers[data.senderId] && onlineUsers[data.receiverId]) {
                if (onlineUsers[data.senderId].receiverId == data.receiverId && onlineUsers[data.receiverId].receiverId == data.senderId)
                  data.status = "READ";
              }

              // uploadImage1(data.media, (err, result) => {
              //   data.media = result;
              // receiveImage = result;
              var saveChat = new chatHistory(data);
              saveChat.roomId = roomId
              console.log("SAVE CHAT IS============>",saveChat);
              // User.findOneAndUpdate({$in:})
              //pull functionality
              User.findOneAndUpdate({ userId: data.senderId }, { $pull: { deletedUsers: data.receiverId } }, { new: true }, (error, res) => {
                if (error) {//console.log("Something went wromg.")
                }

                else {
                  saveChat.save(function (err, result) {
                    if (err) {
                      //console.log("Something went wrong in chat history saving", err)
                    } else {
                      console.log("Chat History saved successfully====================",result);
                    }
                  })
                }
              });
              // })

              // saveChat.save(function (err, result) {
              //         if (err) {
              //           console.log("Something went wrong in chat history saving", err)
              //         } else {
              //           console.log("Chat History saved successfully",result);
              //         }
              //       })
              callback(null, roomId)
            }
          } else {
            // if (result[1].blockedUsers.indexOf(data.senderId) >= 0 || result[0].blockedUsers.indexOf(data.receiverId) >= 0) { } else {

              var roomId = roomId1
              //console.log("======>>>Room id is",roomId);
              //console.log("data for chat history22222222222222222>>>", data)
              if (onlineUsers[data.senderId] && onlineUsers[data.receiverId]) {
                if (onlineUsers[data.senderId].receiverId == data.receiverId && onlineUsers[data.receiverId].receiverId == data.senderId)
                  data.status = "READ";
              }
              // uploadImage1(data.media, (err, result) => {
              //   data.media = result;
              // receiveImage = result;
              var saveChat = new chatHistory(data);
              saveChat.roomId = roomId

              console.log("SAVE CHAT IS============>",saveChat);
              User.findOneAndUpdate({ userId: data.senderId }, { $pull: { deletedUsers: data.receiverId } }, { new: true }, (error, res) => {
                if (error) {  //console.log("Something went wromg.")
                }
                else {
                  saveChat.save(function (err, result) {
                    if (err) {
                      console.log("Something went wrong in chat history saving", err)
                    } else {
                      console.log("chat history saved successfully", result);
                    }
                  })
                }
              })
              // })

              // saveChat.save(function (err, result) {
              //           if (err) {
              //             console.log("Something went wrong in chat history saving", err)
              //           } else {
              //             console.log("chat history saved successfully",result);
              //           }
              //         })
              callback(null, roomId)
           // }
          }
        })
      },
      function (roomId, callback) {
        async.parallel([
          function (callback1) {
            chatHistory.find({
              receiverId: data.receiverId,
              status: "SENT"
            }).count().exec()
              .then((result) => {
                callback1(null, result)
              })
              .catch((failed) => {
                callback1(failed)
              })
          },
          function (callback1) {
            var username = "eventadmindriven";
            var password = "@1!2@3#QWER#";
            var auth = "Basic " + new Buffer(username + ":" + password).toString("base64");

            //var url = 'http://ec2-52-74-93-103.ap-southeast-1.compute.amazonaws.com//PROJECTS/EventDriven/trunk/api_v3_3/version_v3_3/getUnreadNotificationCount';

            var url = 'http://wishalerts.com/api_v3_3/version_v3_3/getUnreadNotificationCount';
            request.post({
              url: url,
              headers: {
                "Authorization": auth
              },
              json: {

                "userID": data.receiverId

              }

            }, function (error, response, body) {  //console.log("request",body," ",error,"++++++","Response",response);
              //console.log("body is "+JSON.stringify(body));
              callback1(null, body.unreadCount)
            });
          }

        ],
          // optional callback
          function (err, results) {
            var type = data.messageType;
            // if(type=="IMAGE"){
            // uploadImage1(data.media, (err, success) => {
            //   if (success)
            //     x = success;

            // }

            // else if(type=="VIDEO"){
            //   uploadVideo(data.media,(err,success)=>{
            //     if(success)
            //       x=success;
            //     })
            //   }
            // console.log(results);
            var badgeCount = parseInt(results[0]) + parseInt(results[1]);
            console.log("Her Data Is==================>",data);
            var requireData ={
              messageType: data.messageType,
              message: data.message,
              senderId: data.senderId,
              senderImage: data.senderImage,
              receiverImage: data.receiverImage,
              media: data.media,
              senderName: data.senderName,
              receiverName: data.receiverName,
              isEncrypted: true,
              timeStamp: utcDate,
              // currentTime: data.currentTime,
              badgeCount: badgeCount,
              
              // pic_url: data.media ? data.media : ""
              //pic_url:"http://ec2-52-74-93-103.ap-southeast-1.compute.amazonaws.com/PROJECTS/EventDriven/trunk/sites/default/files/chat-1525093255.jpg"

            }
            if (onlineUsers[data.receiverId] && sockets[onlineUsers[data.receiverId].socketId]){
              console.log("HERE in DATA =====>", onlineUsers[data.receiverId], sockets[onlineUsers[data.receiverId].socketId] );
              console.log("E#$#$#$#$#$",sockets)
              sockets[onlineUsers[data.receiverId].socketId].socket.emit("receivemessage", {
                requireData
              });
            }
          
              
            // if(onlineUsers[data.senderId] == undefined){
            //   console.log("sender is offline");
            // }
            // else{
            //   sockets[onlineUsers[data.senderId].socketId].socket.emit("receivemessage",{requireData});
            //      }
            // console.log("utc data==>", utcDate)
            //console.log("onlineUsers===============" + JSON.stringify(onlineUsers))
            //if (onlineUsers[data.receiverId] == undefined || onlineUsers[data.receiverId].status == "Away" ) {

            //    console.log("receiver is offline>>>>" + data.receiverId)
            //  sockets[onlineUsers[data.receiverId].socketId].socket.emit("receivemessage",{requireData} );
            //For notification  
            // requireData.message= notify.decryptMessage(requireData.message) 
            // User.findOne({
            //   userId: data.receiverId
            // }, (err, result) => {
            //   if (result) {
            //     if (result.deviceType == 'iOS') {
            //       if (result && result.deviceToken != null) {
            //         notify.iosPush(result.deviceToken, requireData, notify.options1);
            //         notify.iosPush(result.deviceToken, requireData, notify.options2)
            //         notify.iosPush(result.deviceToken, requireData, notify.devOptions)
            //       }
            //   }
            //   }
            // })

            // });
            //  console.log("DAta", data);
          })
      }

    ])
  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  //------------------------------------------ on Disconnect -------------------------------------------------------------//                              
  socket.on('disconnect', function (data) {

    var socketId = socket.id;
    //console.log("socket id in disconnected--" , sockets);
    //console.log("socket id in disconnect111111111111111111--" + sockets[socketId]);

    if (sockets[socketId] != undefined) {

      delete onlineUsers[sockets[socketId].data.userId];
      //onlineUsers[sockets[socketId].data.userId].socketId.pop(socket.id)
      //console.log(" users deleted" + JSON.stringify(onlineUsers));
    } else {
      //console.log("not deleted-----");
    }
    // console.log('Disconnected userId is ', sockets)
    // console.log('connection disconnected---->' + socketId);
  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  /* socket.on('isread', function(data){ chatRoomId, 
       
   })*/
  //------------------------------------------ Read Message -------------------------------------------------------------//  
  socket.on('readMessage', function (data) { //need chatRoomId, lastmsgId, senderId, receiverId
    // console.log("readMessage DATa????", data);
    var query = {
      $or: [{
        $and: [{
          senderId: data.senderId
        }, {
          receiverId: data.receiverId
        }]
      }, {
        $and: [{
          senderId: data.receiverId
        }, {
          receiverId: data.senderId
        }]
      }]
    }
    Room.findOne(query, function (err, result) {
      if (result == null || result == "" || result == undefined) {
        //console.log("users doesnot exist")
      } else {
        Model = generateTableName(result.chatRoomId);
        Model.update({
          lastmsgId: {
            $lte: data.lastmsgId
          },
          receiverId: data.receiverId
        }, {
            $set: {
              status: 'READ'
            }
          }, {
            multi: true
          }, function (err, result) {

            // console.log("Messages above last Message ID  " + data.lastmsgId + " has been read by the Receiver " + data.receiverId);
          })

        if (onlineUsers[data.senderId] == undefined) {
          // console.log("sender is offline");

        } else {
          sockets[onlineUsers[data.senderId].socketId].socket.emit("messageRead", data);
        }
      }
    })
  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  socket.on('currentlyChatting', (data) => {
    if (onlineUsers[data.senderId])
      onlineUsers[data.senderId].receiverId = data.receiverId;
    //console.log("currently chatting", data);
  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  //-------------------------Typing ------------------------//

  socket.on('typing', (data) => {
    if (onlineUsers[data.receiverId]) {

      sockets[onlineUsers[data.receiverId].socketId].socket.emit("userIsTyping", { userId: data.senderId, status: data.status })
    }
  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  //---------------------------------------------Rev --chatting with current user-- Rev-------------------------------//

  socket.on('currentlyChattingReverse', (data) => {
    //console.log("currently chatting reverse", data);
    if (onlineUsers[data.senderId])
      delete onlineUsers[data.senderId].receiverId;

  })


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



  socket.on('blockUser', function (data) {
    //console.log("block user is called")
    if (data.status == 'block') {
      User.findOneAndUpdate({
        userId: data.userId
      }, {
          $push: {
            blockedUsers: data.blockedUserId
          }
        }, {
          new: true
        }, (error, success) => {
          //console.log("Error and success========>", error, "=======================", success)
          if (error) {
            //console.log("Error in blockuser=======>", error)
          }
          else {
            //console.log("Blocked user============>", success);
          }
        })
    } else if (data.status == 'unblock') {
      User.findOneAndUpdate({
        userId: data.userId
      }, {
          $pull: {
            blockedUsers: data.blockedUserId
          }
        }, {
          new: true
        }, (error, success) => {
          // console.log("error and success===>", error, "==================", success)
          if (error) {
            //console.log("Error in unblockuser==>", error)
          }
          else {
            // console.log("Unblocked user==============>", success);
          }
        })
    }
  })

})


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


//------------------------------------------ Helper Functions -------------------------------------------------------------//  

function chatTrue(orderId, mealId) {
  //console.log("Yo betttaaaaa>>" + orderId, mealId)
  OrderList.findOneAndUpdate({
    _id: orderId,
    'meal.mealId': mealId
  }, {
      $set: {
        'meal.$.chatStatus': true
      }
    }, {
      new: true
    }, function (err, result) {
      if (err) console.log("error")
      //console.log("Update true >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" + result)
    })
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// function uploadImage(images, callback) {
//   //console.log("uploadImage function");
//   if (images) {
//     var imageUrl = [];
//     var a = 0;
//     for (var i = 0; i < images.length; i++) {
//       var img_base64 = images[i];
//       binaryData = new Buffer(img_base64, 'base64');
//       require("fs").writeFile("test.jpeg", binaryData, "binary", function (err) { });
//       cloudinary.uploader.upload("test.jpeg", function (result) {
//         if (result.url) {
//           imageUrl.push(result.url);
//           a += i;
//           if (a == i * i) {
//             callback(null, imageUrl);
//           }
//         } else {
//           callback(null, 'http://res.cloudinary.com/ducixxxyx/image/upload/v1480150776/u4wwoexwhm0shiz8zlsv.png')
//         }

//       });
//     }
//   } else {
//     callback(null, "http://res.cloudinary.com/ducixxxyx/image/upload/v1480150776/u4wwoexwhm0shiz8zlsv.png");
//   }
// }


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



app.post('/uploadMedia', function (req, res) {
  console.log("#$#$#$#$")
  let form = new multiparty.Form({ maxFilesSize: 100 * 1024 * 1024 }); //setting max size of image to 10MB
  form.parse(req, (err, fields, files) => {
    if (err) { console.log("err",err);}
    
    else{
      console.log("fields==>",fields);
      console.log("forms==>",files);
    let curso = new urlMedia();
    var c=files.Media[0].path;
    cloudinary.v2.uploader.upload(files.Media[0].path,{ resource_type:"auto"}, (err, result) => {
      if (err) return res.status(500).send({ message: 'Error' });
      curso.media = result.secure_url;
      curso.save((err, cursoSaved) => {
        if (err) {
          return res.status(500).send({ message: 'Error' });
        }
        if (!cursoSaved) return res.status(404).send({ message: 'Empty' });
        return res.status(200).send({ curso: cursoSaved });
      });
    })}
  })
}),


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  app.post('/ChatHistory', function (req, res) {
     //need receiverId, senderId, pageNumber
     console.log("@@@@@@@@@@@@@",req.body);
    var query = {
      $or: [{
        $and: [{
          senderId: req.body.senderId
        }, {
          receiverId: req.body.receiverId
        }]
      }, {
        $and: [{
          senderId: req.body.receiverId
        }, {
          receiverId: req.body.senderId
        }]
      }]
    }
    chatHistory.update(query, {
      $set: {
        status: 'READ'
      }
    }, {
        multi: true
      }, function (err, result) {
        if (err) return res.send({
          responseCode: 500,
          responseMessage: "Something went wrong."
        })
        else {
          var query = {
            $or: [{
              $and: [{
                senderId: req.body.senderId
              }, {
                receiverId: req.body.receiverId
              }, {
                hidden: {
                  $ne: req.body.senderId
                }
              }]
            }, {
              $and: [{
                receiverId: req.body.senderId
              }, {
                senderId: req.body.receiverId
              }, {
                hidden: {
                  $ne: req.body.senderId
                }
              }]
            }]
          }
          //console.log(JSON.stringify(query))
          chatHistory.paginate(query, {
            sort: {
              time: -1
            },
            page: req.body.pageNumber,
            limit:10
          }).then(function (result) {
            console.log("chat history result=======>"+JSON.stringify(result))
            res.send({
              responseCode: 200,
              responseMessage: "Data Found successfully.",
              chatResult: result
            });
          })
        }
      })
  })







// 



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/deleteMessage', function (req, res) {
  //console.log("req.body: ", req.body)
  chatHistory.findByIdAndUpdate(req.body.messageId, {
    $push: {
      hidden: req.body.userId
    }
  }, {
      new: true
    })
    .then((success) => {
      //console.log("delete message success ",success)
      return res.send({
        responseCode: 200,
        responseMessage: "Successfully deleted."
      })
    })
    .catch((error) => {
      //console.log("delete message error ",error)
      res.send({
        responseCode: 500,
        responseMessage: "Something went wrong."
      })
    })
})


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/deleteAllMessages', function (req, res) {
  //console.log("multipple chat delete request",req.body)
  chatHistory.update({
    roomId: req.body.roomId
  }, {
      $push: {
        hidden: req.body.userId
      }
    }, {
      multi: true
    }, (error, success) => {
      if (error) {
        //console.log("muerrorr===>", error)
        res.send({
          responseCode: 500,
          responseMessage: "Something went wrong."
        })
      } else {
        //console.log("success====>", success)
        res.send({
          responseCode: 200,
          responseMessage: "Successfully deleted."
        })
      }
    })
})


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/blockUser', function (req, res) {
  //console.log(req.body)
  User.findOneAndUpdate({
    userId: req.body.userId
  }, {
      $push: {
        blockedUsers: req.body.blockedUserId
      }
    }, {
      new: true
    }, (error, success) => {
      //console.log("error and success=========>", error, "================", success)
      if (error)
        res.send({
          responseCode: 500,
          responseMessage: "Something went wrong."
        })
      else
        res.send({
          responseCode: 200,
          responseMessage: "User is successfully blocked."
        })
    })
})


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/unblockUser', function (req, res) {
  //console.log(req.body)
  User.findOneAndUpdate({
    userId: req.body.userId
  }, {
      $pull: {
        blockedUsers: req.body.blockedUserId
      }
    }, {
      new: true
    }, (error, success) => {
      if (error)
        res.send({
          responseCode: 500,
          responseMessage: "Something went wrong."
        })
      else
        res.send({
          responseCode: 200,
          responseMessage: "User is successfully unblocked."
        })
    })
})


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/deleteUser', (req, res) => {
  //console.log("User delete request"+JSON.stringify(req.body))
  waterfall([
    (callback) => {
      User.findOneAndUpdate({
        userId: req.body.userId
      }, {
          $push: {
            deletedUsers: req.body.deleteUserId
          }
        }, {
          new: true
        }, (error, result) => {
          if (error)
            callback(error);
          else
            callback(null, result)
        });
    },
    (res, callback) => {
      chatHistory.update({
        roomId: req.body.roomId
      }, {
          $push: {
            hidden: req.body.userId
          }
        }, {
          multi: true
        })
        .exec((success) => {
          //console.log("delete message success ",success)
          //   return res.send({
          //   responseCode: 200,
          //   responseMessage: "Successfully deleted."
          // })
          callback(null, success)
        }, (error) => {
          //console.log("delete message error ",error)
          //   res.send({
          //   responseCode: 500,
          //   responseMessage: "Something went wrong."
          // })
          callback(error)
        });
    }
  ], (error, results) => {
    if (error)
      res.send({ responseCode: 500, responseMessage: "Something went wrong." })
    else
      res.send({ responseCode: 200, responseMessage: "User deleted successfully." })
  })

})


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/testPush', function (req, res) {
  var requireData = {
    name: "rinku",
    sdsd: "sdsdsdsds"
  }
  notify.iosPush(req.body.deviceToken, requireData, pemFiles.options1);
  notify.iosPush(req.body.deviceToken, requireData, pemFiles.options2)
})


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



'use strict';
app.post('/logoutApi', function (req, res) {
  User.findOneAndUpdate({
    userId: req.body.userId
  }, {
      $set: {
        deviceToken: null
      }
    }, function (err, result) {
      if (err) {
        res.send({
          responseCode: 403,
          responseMessage: 'Something went wrong'
        });

      } else {
        res.send({
          responseCode: 200,
          responseMessage: 'Logout successfully'
        });
      }
    })
})


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/userConversationList', function (req, res) {
  var userId = req.body.userId;
  User.findOne({
    userId: userId
  }, (findError, findSuccess) => {
    console.log("error"+JSON.stringify(findError))
    console.log("success"+JSON.stringify(findSuccess))
    if (findError)
      res.send(findError);
    else {
      if (findSuccess) {
        req.body.pattern = req.body.pattern ? req.body.pattern : '';
        //console.log("Pattern is=====>",req.body.pattern) {userName:{$regex:req.body.pattern,$options:'i'}}

        Room.find({ 'participants.userId': { $in: [req.body.userId] } }, { _id: 0, chatType: 0, createdAt: 0, status: 0, participants: 0, __v: 0 }, (error, result1) => {
          if (error)
            console.log(error)
          else if (res.length == 0)
            res.send({ result: result1 })
          else {
            let usersIds = [];
            usersIds = result1.map(x => {
              if (x.activeUsers[0] == req.body.userId)
                return x.activeUsers[1]
              else
                return x.activeUsers[0]
            })
            console.log("final result",usersIds)
            User.find({ $and: [{ userName: { $regex: req.body.pattern, $options: 'i' } }, { userId: { $in: usersIds } }] }).sort({ userId: -1 }).exec((err, result) => {
              if (err)
                console.log(err)
              else if (result.length == 0) {
                res.send({ responseCode: 200, responseMessage: "No user found.", result: result })
              }
              else {
                if (err) {
                  return res.send(err);
                }
                else if (result.length == 0) {
                  return res.send({ responseCode: 400, responseMessage: "No users found" })
                }
                else {
                  console.log("result==>",result,"++++++++++++");
                  var userList = [],
                    counter = 0,
                    len = result.length;
                  //console.log("result====>",result)
                  _.each(result, function (sq) {
                    var query = {
                      $and: [{
                        $or: [{
                          senderId: userId
                        }, {
                          receiverId: userId
                        }]
                      }, {
                        $or: [{
                          senderId: sq.userId
                        }, {
                          receiverId: sq.userId
                        }]
                      },
                      { hidden: { $nin: [sq.userId] } }
                      ]
                    };
                    chatHistory.findOne(query).sort({
                      time: -1
                    }).exec(function (err, chatResult) {
                      console.log("chat result",chatResult)

                      if (err) {
                        res.send({
                          responseCode: 401,
                          responseMessage: 'Something went wrong',
                          err: err
                        });
                      } else {
                        //  console.log("userId==>",sq.userId)
                        // query.$and.push({ 
                        //   status: "SENT"
                        // })
                        var unreadMessages = 0;
                        chatHistory.find({
                          $and: [{
                            senderId: sq.userId
                          }, {
                            receiverId: userId
                          }],
                          status: "SENT"
                        }).count().exec().then((result) => {
                          console.log("result===============================>", result);
                          unreadMessages = result;

                          if (chatResult && userId != sq.userId) {
                            let isBlock = false;
                            let isOnline = false;
                            //console.log(findSuccess, "find success")
                            // console.log(findSuccess.blockedUsers,"-----------",findSuccess.blockedUsers.indexOf(sq.userId),"----------",sq.userId)
                            if (findSuccess.blockedUsers && findSuccess.blockedUsers.indexOf(sq.userId) < 0)
                              isBlock = false
                            else
                              isBlock = true
                            //  console.log(chatResult);
                            // console.log("blocked===>",sq.blockedUsers.indexOf(userId))
                            //console.log("online check===>",onlineUsers[sq.userId],"-------",onlineUsers) findSuccess.deletedUsers.indexOf(sq.userId) < 0 &&
                            if (onlineUsers[sq.userId])
                              isOnline = true;
                            //console.log("chatresult===>", JSON.stringify(chatResult));
                            let indx = chatResult.hidden.findIndex(x => x == chatResult.senderId);
                            //console.log("delete users "+findSuccess.deletedUsers.indexOf(sq.userId))
                            if (findSuccess.deletedUsers.indexOf(sq.userId) < 0 && sq.blockedUsers.indexOf(userId) < 0)
                              userList.push({
                                participant_id: sq.userId,
                                userName: sq.userName,
                                profilePic: sq.profilePic,
                                profilePicFull: sq.profilePicFull,
                                message_type: indx > -1 ? '' : chatResult.messageType,
                                isEncrypted: chatResult.isEncrypted,
                                isBlock: isBlock,
                                lastMsg: indx > -1 ? '' : chatResult.message,
                                roomId: chatResult.roomId,
                                time: chatResult.time,
                                isOnline: isOnline,
                                unreadMessages: unreadMessages
                              });
                          }
                          if (++counter == len) {
                            let pageNumber = req.body.pageNumber == 1 ? 1 : req.body.pageNumber;
                            let maxResult = 2;
                            let start = (pageNumber * maxResult) - maxResult;
                            let end = pageNumber * maxResult;
                            let totalPage = Math.ceil(userList.length / maxResult)
                            console.log("start======>>>" + start + "  end=======>>>>" + end + "  page number is" + pageNumber)
                            userList.sort(function (a, b) {
                              //console.log(typeof(a.time))
                              return new Date((a.timeStamp).toString()).getTime() - new Date((b.timeStamp  ).toString()).getTime();
                            });
                            userList.reverse();

                            var dataList = userList.slice(start, end);

                            console.log("datalist after======>>>", dataList)


                            if (req.body.pattern) {
                              dataList.sort(function (a, b) {
                                var textA = a.userName.toUpperCase();
                                var textB = b.userName.toUpperCase();
                                return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
                              });
                            }
                            //else

                            //console.log("datalist lenght"+dataList.length)
                            var data = {
                              data: dataList,
                              pageNumber: pageNumber,
                              totalPage: totalPage
                            }
                            console.log("chatlist", dataList)
                            res.send({
                              responseCode: 200,
                              responseMessage: 'list found',
                              result: data
                            });
                          }
                        }).catch((failed) => {
                          console.log("failed", failed)
                        });
                      }

                    })
                  });
                }
              }
            })
          }
        })

      } else
        res.send({
          responseCode: 400,
          responseMessage: "User Not Found"
        });
    }
  })
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/userStatus', (req, res) => {
  if (onlineUsers[req.body.userId])
    res.send({ responseCode: 200, responseMessage: 'User is online' })
  else
    res.send({ responseCode: 201, responseMessage: 'User is offline' })
})


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



app.post('/totalUnreadMessageCount', (req, res) => {
  var userId = req.body.userId;
  var unreadMessages = 0;
  chatHistory.find({
    receiverId: userId,
    status: "SENT"
  }).count().exec()
    .then((result) => {
      res.send({
        responseCode: 200,
        responseMessage: 'Total Unread Message',
        result: result
      });
    })
    .catch((failed) => {
      res.send({
        responseCode: 500,
        responseMessage: 'Unexpected Error',
      });
    })
})


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



var googleTranslate = require('google-translate')('AIzaSyBDfR0AY42tm95s9yRytJ0N5sNGZri7PTU');
// app.get("/translate", (req, res) => {
//   googleTranslate.translate("my name is naveen", 'en', function (err, translation) {
//     console.log(err);
//   });
// })


// translate('Ik spreek Engels', { to: 'en' }).then(res => {
//   console.log(res.text);
//   //=> I speak English
//   console.log(res.from.language.iso);
//   //=> nl
// }).catch(err => {
//   console.error(err);
// });


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

server.listen(9211, function () {
  console.log(' Chat Server is listening on ', server.address().port);
});


function compare(a, b) {
  const user1 = new Date(a.time).getTime();
  const user2 = new Date(b.time).getTime();
  //console.log("user1===>", user1, "user2===>", user2);
  let comparison = 0;
  if (new Date(user1).getTime() > new Date(user2).getTime()) {
    comparison = -1;
  } else if (new Date(user1).getTime() > new Date(user2).getTime()) {
    comparison = 1;
  }
  return comparison;
}

