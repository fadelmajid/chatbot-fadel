const config = require('../config');
const request = require('request');

class ClientController {
    static async sendTextMessage(recipientId, text) {
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                text: text
            }
        }
        this.callSendAPI(messageData);
    }

    /*
    * Send an image using the Send API.
    *
    */
    static async sendImageMessage(recipientId, imageUrl) {
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                attachment: {
                    type: "image",
                    payload: {
                        url: imageUrl
                    }
                }
            }
        };

        this.callSendAPI(messageData);
    }

    static async sendGenericMessage(recipientId, elements) {
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: elements
                    }
                }
            }
        };

        this.callSendAPI(messageData);
    }

    /*
    * Send a message with Quick Reply buttons.
    *
    */
    static async sendQuickReply(recipientId, text, replies, metadata) {
        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                text: text,
                metadata: this.isDefined(metadata)?metadata:'',
                quick_replies: replies
            }
        };

        this.callSendAPI(messageData);
    }

      /*
    * Turn typing indicator on
    *
    */
    static async sendTypingOn(recipientId) {


        var messageData = {
            recipient: {
                id: recipientId
            },
            sender_action: "typing_on"
        };

        this.callSendAPI(messageData);
    }

    /*
    * Turn typing indicator off
    *
    */
    static async sendTypingOff(recipientId) {
        var messageData = {
            recipient: {
                id: recipientId
            },
            sender_action: "typing_off"
        };

        this.callSendAPI(messageData);
    }


    /*
    * Call the Send API. The message data goes in the body. If successful, we'll
    * get the message id in a response
    *
    */
    static async callSendAPI(messageData) {
        request({
            uri: 'https://graph.facebook.com/v3.2/me/messages',
            qs: {
                access_token: config.FB_PAGE_TOKEN
            },
            method: 'POST',
            json: messageData

        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var recipientId = body.recipient_id;
                var messageId = body.message_id;

                if (messageId) {
                    console.log("Successfully sent message with id %s to recipient %s",
                        messageId, recipientId);
                } else {
                    console.log("Successfully called Send API for recipient %s",
                        recipientId);
                }
            } else {
                console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
            }
        });
    }



}

module.exports = ClientController;
