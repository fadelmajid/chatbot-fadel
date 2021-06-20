const config = require('../config');
const moment = require('moment');
const dialogflow = require('dialogflow');
const sessionIds = new Map();
const Client = require('../clients/index')
const uuid = require('uuid');

const credentials = {
    client_email: config.GOOGLE_CLIENT_EMAIL,
    private_key: config.GOOGLE_PRIVATE_KEY,
};

const sessionClient = new dialogflow.SessionsClient(
    {
        projectId: config.GOOGLE_PROJECT_ID,
        credentials
    }
);

class FnController {
    static receivedMessage(event) {
        var senderID = event.sender.id;
        var message = event.message;

        if (!sessionIds.has(senderID)) {
            sessionIds.set(senderID, uuid.v1());
        }
        
        var isEcho = message.is_echo;
        var messageId = message.mid;
        var appId = message.app_id;
        var metadata = message.metadata;

        // You may get a text or attachment but not both
        var messageText = message.text;
        var messageAttachments = message.attachments;
        var quickReply = message.quick_reply;

        if (isEcho) {
            this.handleEcho(messageId, appId, metadata);
            return;
        } else if (quickReply) {
            this.handleQuickReply(senderID, quickReply, messageId);
            return;
        }

        if (messageText) {
            //send message to api.ai
            this.sendToDialogFlow(senderID, messageText);
        } else if (messageAttachments) {
            this.handleMessageAttachments(messageAttachments, senderID);
        }
    }

    static handleMessageAttachments(messageAttachments, senderID){
        //for now just reply
        Client.sendTextMessage(senderID, "Attachment received. Thank you.");
    }

    static handleQuickReply(senderID, quickReply, messageId) {
        var quickReplyPayload = quickReply.payload;
        console.log("Quick reply for message %s with payload %s", messageId, quickReplyPayload);
        //send payload to api.ai
        sendToDialogFlow(senderID, quickReplyPayload);
    }

    //https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-echo
    static handleEcho(messageId, appId, metadata) {
        // Just logging message echoes to console
        console.log("Received echo for message %s and app %d with metadata %s", messageId, appId, metadata);
    }

    static handleDialogFlowAction(sender, action, messages, contexts, parameters, response) {
        if(action == 'GetContactData.GetContactData-yes'){
            const birthdate = parameters.fields.birthdate.stringValue;
            const today = moment().format('YYYY-MM-DD');
            const years = moment().diff(birthdate, 'years');
            const adjustToday = birthdate.substring(5) === today.substring(5) ? 0 : 1;
            const nextBirthday = moment(birthdate).add(years + adjustToday, 'years');
            const daysUntilBirthday = nextBirthday.diff(today, 'days');

            Client.sendTextMessage(sender, `There are ${daysUntilBirthday} days left until your next birthday`);
        }else{
            //unhandled action, just send back the text
            this.handleMessages(messages, sender);
        }
    }

    static async handleMessage(message, sender) {
        switch (message.message) {
            case "text": //text
                message.text.text.forEach(async (text) => {
                    if (text !== '') {
                        Client.sendTextMessage(sender, text);
                    }
                });
                break;
            case "quickReplies": //quick replies
                let replies = [];
                message.quickReplies.quickReplies.forEach((text) => {
                    let reply =
                        {
                            "content_type": "text",
                            "title": text,
                            "payload": text
                        }
                    replies.push(reply);
                });
                Client.sendQuickReply(sender, message.quickReplies.title, replies);
                break;
            case "image": //image
                Client.sendImageMessage(sender, message.image.imageUri);
                break;
        }
    }

    static handleCardMessages(messages, sender) {
        let elements = [];
        for (var m = 0; m < messages.length; m++) {
            let message = messages[m];
            let buttons = [];
            for (var b = 0; b < message.card.buttons.length; b++) {
                let isLink = (message.card.buttons[b].postback.substring(0, 4) === 'http');
                let button;
                if (isLink) {
                    button = {
                        "type": "web_url",
                        "title": message.card.buttons[b].text,
                        "url": message.card.buttons[b].postback
                    }
                } else {
                    button = {
                        "type": "postback",
                        "title": message.card.buttons[b].text,
                        "payload": message.card.buttons[b].postback
                    }
                }
                buttons.push(button);
            }

            let element = {
                "title": message.card.title,
                "image_url":message.card.imageUri,
                "subtitle": message.card.subtitle,
                "buttons": buttons
            };
            elements.push(element);
        }
        Client.sendGenericMessage(sender, elements);
    }

    static handleMessages(messages, sender) {
        let timeoutInterval = 1100;
        let previousType ;
        let cardTypes = [];
        let timeout = 0;
        for (var i = 0; i < messages.length; i++) {
            if ( previousType == "card" && (messages[i].message != "card" || i == messages.length - 1)) {
                timeout = (i - 1) * timeoutInterval;
                setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
                cardTypes = [];
                timeout = i * timeoutInterval;
                setTimeout(this.handleMessage.bind(null, messages[i], sender), timeout);
            } else if ( messages[i].message == "card" && i == messages.length - 1) {
                cardTypes.push(messages[i]);
                timeout = (i - 1) * timeoutInterval;
                setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
                cardTypes = [];
            } else if ( messages[i].message == "card") {
                cardTypes.push(messages[i]);
            } else  {
                timeout = i * timeoutInterval;
                setTimeout(this.handleMessage.bind(null, messages[i], sender), timeout);
            }

            previousType = messages[i].message;
        }
    }

    static handleDialogFlowResponse(sender, response) {
        let responseText = response.fulfillmentText;
        let messages = response.fulfillmentMessages;
        let action = response.action;
        let contexts = response.outputContexts;
        let parameters = response.parameters;

        Client.sendTypingOff(sender);

        if (this.isDefined(action)) {
            this.handleDialogFlowAction(sender, action, messages, contexts, parameters, response);
        } else if (this.isDefined(messages)) {
            this.handleMessages(messages, sender);
        } else if (responseText == '' && !this.isDefined(action)) {
            //dialogflow could not evaluate input.
            Client.sendTextMessage(sender, "I'm not sure what you want. Can you be more specific?");
        } else if (this.isDefined(responseText)) {
            Client.sendTextMessage(sender, responseText);
        }
    }

    static async sendToDialogFlow(sender, textString, params) {

        Client.sendTypingOn(sender);

        try {
            const sessionPath = await sessionClient.sessionPath(
                config.GOOGLE_PROJECT_ID,
                sessionIds.get(sender)
            );

            const request = {
                session: sessionPath,
                queryInput: {
                    text: {
                        text: textString,
                        languageCode: config.DF_LANGUAGE_CODE,
                    },
                },
                queryParams: {
                    payload: {
                        data: params
                    }
                }
            };
            const responses = await sessionClient.detectIntent(request);
            const result = responses[0].queryResult;
            this.handleDialogFlowResponse(sender, result);
        } catch (e) {
            console.log('error');
            console.log(e);
        }
    }

    /*
    * Postback Event
    *
    * This event is called when a postback is tapped on a Structured Client. 
    * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
    * 
    */
    static receivedPostback(event) {
        var senderID = event.sender.id;
        var recipientID = event.recipient.id;
        var timeOfPostback = event.timestamp;

        // The 'payload' param is a developer-defined field which is set in a postback
        // button for Structured Messages.
        var payload = event.postback.payload;

        switch (payload) {
            default:
                //unindentified payload
                Client.sendTextMessage(senderID, "I'm not sure what you want. Can you be more specific?");
                break;
        }

        console.log("Received postback for user %d and page %d with payload '%s' " +
            "at %d", senderID, recipientID, payload, timeOfPostback);

    }

    /*
    * Authorization Event
    *
    * The value for 'optin.ref' is defined in the entry point. For the "Send to 
    * Messenger" plugin, it is the 'data-ref' field. Read more at 
    * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
    *
    */
    static receivedAuthentication(event) {
        var senderID = event.sender.id;
        var recipientID = event.recipient.id;
        var timeOfAuth = event.timestamp;

        // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
        // The developer can set this to an arbitrary value to associate the
        // authentication callback with the 'Send to Messenger' click event. This is
        // a way to do account linking when the user clicks the 'Send to Messenger'
        // plugin.
        var passThroughParam = event.optin.ref;

        console.log("Received authentication for user %d and page %d with pass " +
            "through param '%s' at %d", senderID, recipientID, passThroughParam,
            timeOfAuth);

        // When an authentication is received, we'll send a message back to the sender
        // to let them know it was successful.
        Client.sendTextMessage(senderID, "Authentication successful");
    }

    static isDefined(obj) {
        if (typeof obj == 'undefined') {
            return false;
        }

        if (!obj) {
            return false;
        }

        return obj != null;
    }
}

module.exports = FnController;
