//IF NGROK GETS RESET, PUT NEW FORWARD URL HERE:
//https://api.slack.com/apps/A6G2BGPUK/interactive-messages?saved=1

// RTM installs
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;
var IncomingWebhook = require('@slack/client').IncomingWebhook;

// RTM requires
var token = process.env.SLACK_API_TOKEN || '';
var url = process.env.WEBHOOK_URL || '';
var web = new WebClient(token);
var WebHook = new IncomingWebhook(url)
var rtm = new RtmClient(token);

// Express installs
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var connect = process.env.MONGODB_URI;
var axios = require('axios');
var models = require('./models/models');
var routes = require('./routes/routes');
var checkConflict = require('./handleConflict');
var findFreeTimes = require('./findFreeTimes');
var findFreeTime = require('./findFreeTest');
var User = models.User;

var urlencodedParser = bodyParser.urlencoded({ extended: false });
mongoose.connect(connect);
var app = express();
// view engine setup
var hbs = require('express-handlebars')({
  defaultLayout: 'main',
  extname: '.hbs'
});
app.engine('hbs', hbs);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(logger('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const postAI = function(message, userId) {
  // curl 'https://api.api.ai/api/query?v=20150910&query=hi&lang=en&sessionId=bad504f3-0f2c-463e-8d34-d9097fe24091&timezone=2017-08-01T10:53:53-0700' -H 'Authorization:Bearer 62a307990113474eade3e4a3a7472e4f'
  return axios.post('https://api.api.ai/v1/query?v=20150910', {
      query: message,
      lang: 'en',
      sessionId: userId,
      timezone: "2017-08-01T10:53:53-0700"
    },
    {
      headers: {Authorization: `Bearer ${process.env.APIAI_TOKEN}`}
    }
  )
}

const parseMessage = function(message) {
  var split = message.split('=');
  var subject = split[1].split(' ');
  subject.pop();
  subject = subject.join(' ');
  var inviteesArray = split[2].split(' ');
  var invitees = [];
  inviteesArray.forEach(function(word) {
    if (word.indexOf('@') !== -1) {
      invitees.push(word);
    }
  });
  var inviteesID = invitees.map(function(word) {
    return word.slice(2, word.length);
  })
  var date = split[3].split(' ')[0];
  var time = split[4].split(' ')[0];

  return {
    'date': date,
    'subject': subject,
    'inviteesID': inviteesID,
    'time': time
  }
}

const findUsersBySlack = function(inviteesID) {
  return new Promise(function(resolve, reject) {
    var userPromises = inviteesID.map(function(id) {
      return User.findOne({slackID: id}).exec();
    })
    Promise.all(userPromises)
      .then(function(userObjects) {
        userObjects.forEach(function(user) {
          if (!user.google) {
            console.log('Found user without google auth, the message below shoudl send', user.slackUsername);
            console.log(rtm.dataStore.users.U6G8A3413._properties);
            console.log(rtm.dataStore.users.U6G8A3413.profile);
            web.chat.postMessage('@'+user.slackUsername, "You have not authenticated with Google Calendar yet. Please follow this link to authenticate: " + process.env.DOMAIN + "/connect?auth_id=" + user._id)
            // while (!user.google) {
            //   console.log('waitng...');
            // }
            return
          }
        })
        resolve(userObjects)
      })
      .catch((err) => {
        console.log("finding user err: ", err);
        reject(err);
      })
  })
}

const confirmMessage = function(channel, message, user) {
  if (message.includes("set!") && message.includes("Reminder")) {
    // web.chat.postMessage(channel, message, web.chat.postMessage(channel, message)
    web.chat.postMessage(channel, message+' Confirm that this event is ok? ', { "attachments": [
          {
              "fallback": "Unable to set calendar event",
              "callback_id": "wopr_game",
              "color": "#3AA3E3",
              "attachment_type": "default",
              "actions": [
                {
                    "name": "reminder",
                    "text": "Yes",
                    "type": "button",
                    "value": "scheduleReminder",
                    "confirm": {
                      "title": "Are you sure?",
                      "text": "This will add a calendar reminder to your google account",
                      "ok_text": "Yes",
                      "dismiss_text": "No"
                    }
                },
                {
                    "name": "reminder",
                    "text": "No",
                    "type": "button",
                    "value": "dontScheduleReminder",
                    "confirm": {
                      "title": "Are you sure you want to cancel?",
                      "text": "This reminder will not be saved",
                      "ok_text": "Yes",
                      "dismiss_text": "No"
                    }
                },
            ]
          }
      ]}, function(err, res) {
    if (err) {
      console.log('Error:', err);
    } else {
      console.log('Message sent: ', res);
    }
    })
  } else if (message.includes("set!") && message.includes("Meeting")) {
    var messageObj = parseMessage(message);
    console.log('yooooo', messageObj);
    findUsersBySlack(messageObj.inviteesID)
    .then((userObjects) => {
      var checkingUserObj = {}
      var interval;
      userObjects.forEach(function(userObj) {
          while (!userObj.google) {
            interval = setInterval(function() {console.log('waiting for input')}, 10000)
            }
            console.log('we broke out!');
            clearInterval(interval)
        })
      checkConflict(messageObj, user)
      .then((list) => {
        var completeEventTimeList = [].concat.apply([], list);

        // if (checkedConflict.conflict) {
        //     findFreeTimes(checkedConflict.returnValue)
        //     return the rtm message that let user click on 1 of 10 freetimes
        // } else{
        //   just as the user to confirm the meeting at the set time.
        // }
        if (!findFreeTime(completeEventTimeList, messageObj)) {
          web.chat.postMessage(channel, message+' Confirm that this event is ok? ', { "attachments": [
                {
                    "fallback": "Unable to set calendar event",
                    "callback_id": "wopr_game",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                      {
                          "name": "meeting",
                          "text": "Yes",
                          "type": "button",
                          "value": "scheduleMeeting",
                          "confirm": {
                            "title": "Are you sure?",
                            "text": "This will add a calendar meeting to your google account",
                            "ok_text": "Yes",
                            "dismiss_text": "No"
                          }
                      },
                      {
                          "name": "meeting",
                          "text": "No",
                          "type": "button",
                          "value": "dontScheduleMeeting",
                          "confirm": {
                            "title": "Are you sure you want to cancel?",
                            "text": "This meeting will not be saved",
                            "ok_text": "Yes",
                            "dismiss_text": "No"
                          }
                      },
                  ]
                }
            ]}, function(err, res) {
            if (err) {
              console.log('Error:', err);
            } else {
              console.log('Message sent: ', res);
            }
          })
        }
        else {
          alternateDateArr = findFreeTime(completeEventTimeList, messageObj);
          var niceDateArr = []
          var actualMessage = message
          alternateDateArr.map((time) => {
            var niceDate = new Date(time)
            niceDateArr.push({"text": new Date(time).toUTCString(), "value": new Date(time)
            })
          })
          web.chat.postMessage(channel, "Unfortunately, that time won't work. Here are some available times!",
          { "attachments": [
            {
                "text": "Choose a different date",
                "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "callback_id": actualMessage,
                "actions": [
                    {
                        "name": "Alternative_Dates",
                        "text": "Pick a date and time",
                        "type": "select",
                        "options": niceDateArr
                    }
                ]
            }
          ]}
        )
      }
      })
      .catch(err => {
        console.log("err using checkConflict in bot", err);
      })
    })
  }
  else {
    web.chat.postMessage(channel, message)
  }
}

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  //console.log("HEREEEEEEEE: ", message)
  app.use('/', routes(rtm, web, message));
  var newMessage = message.text
  // console.log('THIS I SUSER MESSAGE: ', userMessage);
  var dm = rtm.dataStore.getDMByUserId(message.user);
  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    return;
  }
  else {
    var slackUser = rtm.dataStore.getUserById(message.user);
    //console.log('HERES A BUNCH OF INFO: slackID: ', user.id, 'slackUsername: ', user.name, 'slackEmail: ', user.profile.email);

    User.findOne({slackEmail: slackUser.profile.email}, function(err, user) {
      if (err) {
        console.log(err);
      } else if (user) {
        if (user.google) {
          postAI(message.text, message.user)
          .then((data) =>
            {
            const msg = data.data.result.fulfillment.speech
            confirmMessage(message.channel, msg, user)
          })
          .catch((err) => (
            console.log('error ', err)))
        } else {
          web.chat.postMessage(message.channel, "You have not authenticated with Google Calendar yet. Please follow this link to authenticate: " + process.env.DOMAIN + "/connect?auth_id=" + user._id);
        }
      } else if (! user) {
        new User({
          slackID: slackUser.id,
          slackUsername: slackUser.name,
          slackEmail: slackUser.profile.email,
        }).save(function(err, user) {
          if (err) {
            console.log(err);
          } else {
            web.chat.postMessage(message.channel, "You have not authenticated with Google Calendar yet. Please follow this link to authenticate: " + process.env.DOMAIN + "/connect?auth_id=" + user._id);
          }
        });
      }
    });
  }
});

rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
  console.log('Reaction added:', reaction);
});

rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
  console.log('Reaction removed:', reaction);
});

var port = process.env.PORT || 3000;
app.listen(port);
rtm.start();
