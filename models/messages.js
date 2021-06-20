'use strict';

module.exports = (sequelize, dataTypes) => {
    const Messages = sequelize.define('Messages', {
        id: {
            type: dataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        sender_id: {
            type: dataTypes.STRING,
            allowNull: true
        },
        message_id: {
            type: dataTypes.STRING,
            allowNull: false
        },
        message_description: {
            type: dataTypes.TEXT,
            allowNull: true
        },
        message_detail: {
            type: dataTypes.TEXT,
            allowNull: true
        }
    },  {
        underscored: false,
        freezeTableName: true,
        tableName: 'messages'
    });

    return Messages;
};