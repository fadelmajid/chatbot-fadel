const { Messages } = require('../models');
const Fn = require('../functions/index');
const config = require('../config');

class Controller {
    static healthCheck(req, res) {
        res.send('Hello world, I am a chat bot')
    }

    static facebookVerification(req, res) {
        console.log("request");
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.FB_VERIFY_TOKEN) {
            res.status(200).send(req.query['hub.challenge']);
        } else {
            console.error("Failed validation. Make sure the validation tokens match.");
            res.sendStatus(403);
        }
    }

    static callback(req, res) {
        let data = req.body;
        console.log(JSON.stringify(data));

        if (data.object == 'page') {
            // Iterate over each entry
            // There may be multiple if batched
            data.entry.forEach(function (pageEntry) {
                // Iterate over each messaging event
                pageEntry.messaging.forEach(async function (messagingEvent) {
                    Messages.create({
                        message_id: messagingEvent.message.mid || '-',
                        sender_id: messagingEvent.sender.id || '-',
                        message_description: messagingEvent.message.text,
                        message_detail: JSON.stringify(data),
                    })
                    if (messagingEvent.optin) {
                        Fn.receivedAuthentication(messagingEvent);
                    } else if (messagingEvent.message) {
                        Fn.receivedMessage(messagingEvent);
                    } else if (messagingEvent.postback) {
                        Fn.receivedPostback(messagingEvent);
                    } else {
                        console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                    }
                });
            });

            // Assume all went well.
            // You must send back a 200, within 20 seconds
            res.sendStatus(200);
        }
    }

    static getAllMessages(req, res){
        Messages.findAll({
            order: [['id', 'DESC']]
        })
        .then(data => {
            res.send(data)
        })
        .catch(err => {
            res.send(err)
        })
    }

    static getMessage(req, res){
        Messages.findOne({
            where: {
                message_id: req.params.message_id
            }
        })
        .then(data => {
            res.send(data)
        })
        .catch(err => {
            res.send(err)
        })
    }

    static deleteMessage(req, res){
        Messages.destroy({
            where: {
                message_id: req.params.message_id
            }
        })
        .then(data => {
            res.send(data)
        })
        .catch(err => {
            res.send(err)
        })
    }
}

module.exports = Controller;
