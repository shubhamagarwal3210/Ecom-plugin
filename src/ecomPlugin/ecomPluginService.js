const { async } = require('@firebase/util');
const { db } = require('../../firebase.js');
const CONSTANT = require("./constant.json");

/*
    1: Currently hardcoded the collection name, should be picked from a file
    2: Currently we have only one collection but in future can lead to errors
*/

const getCustomerById = async (id) => {
    const collectionRef = db.collection('Plugin');
    const queryRef = collectionRef.where('customer_id', '==', id).limit(1);
    try {
        const snapshot = await queryRef.get();
        if (snapshot.empty) {
            console.log('No matching documents.');
            return [];
        }
        let snapshotData = [];
        snapshot.forEach(async doc => {
            console.log(doc.id, '=>', doc.data());
            snapshotData.push({
                id: doc.id,
                data: doc.data()
            })
        });
        return snapshotData;
    } catch (err) {
        console.log('Error getting documents', err);
        return [];
    }
}

const createAbandonedInDB = async (payload) => {
    try {
        const docRef = db.collection('Plugin').doc();
        return await docRef.set(payload)
            .then(() => {
                console.log(`Document added Successfully for payload: ${payload}`);
                return CONSTANT.SUCCESS;
            })
            .catch((error) => {
                console.error(`Error adding document: ${error} with body : ${payload}`);
                return CONSTANT.FAIL;
            });
    } catch (ex) {
        console.error(`Error in createBillingInDB : ${ex} body : ${payload}`);
        return CONSTANT.FAIL;
    }
}

const updateAbandonedById = async (id, dataToUpdate) => {
    const documentRef = db.collection('Plugin').doc(id);
    try {
        await documentRef.update(dataToUpdate);
        console.log('Document updated successfully');
        return CONSTANT.SUCCESS;
    } catch (err) {
        console.error('Error updating document:', err);
        return CONSTANT.FAIL;
    }
}

const deleteCollectionById = async (docId) => {
    return await db.collection('Plugin').doc(docId).delete()
        .then((res) => {
            console.log(`Document successfully deleted: ${docId}, response: ${res}`);
            return CONSTANT.SUCCESS;
        })
        .catch((error) => {
            console.error(`Error removing document: ${docId}: error : ${error} `);
            return CONSTANT.FAIL;
        });
}

const getCheckOutDetails = async () => {
    try {
        const dbRef = db.collection('Plugin');
        return await dbRef.get();
    } catch (ex) {
        console.error(`Error in getCheckOutDetails : ${ex}`);
        return CONSTANT.FAIL;
    }
}

const getNextNotificationTime = async (notification_count, latest_abandoned_time) => {
    const createdAt = latest_abandoned_time.toDate();
    const notificationTimeInSecond = CONSTANT[notification_count];
    if (notificationTimeInSecond != CONSTANT.MAX_NOTIFICATION_SEND) {
        return new Date(createdAt.getTime() + notificationTimeInSecond * 1000);
    }
    // This will ensure it would be send then the max limit, as this time will never come in future
    return createdAt;
}

const getPendingOrders = async (checkOutDetails) => {
    let payload = [];
    await checkOutDetails.forEach(async doc => {
        const data = doc.data();
        const documentId = doc.id;
        const notificationNeedToBeSend = await isNotificationRequired(data.total_notification_send, data.next_notification_at, documentId);
        if (notificationNeedToBeSend) {
            const nextNotificationTime = await getNextNotificationTime(data.total_notification_send + 2, data.latest_abandoned_time);
            payload.push({
                id: documentId,
                data : {
                    total_notification_send: data.total_notification_send,
                    next_notification_at: nextNotificationTime,
                    notifications : data.notifications,
                }
            })
        }
    })
    return payload;
}

const sendNotificationUtil = async (payloadToSendNotification) => {
    if (payloadToSendNotification.length == 0) {
        console.log("No checkout pending....")
        return CONSTANT.SUCCESS;
    }
    //Updating the notification details in the DB
    payloadToSendNotification.forEach(async payload => {
        const message = `This is the notification ${payload.data.total_notification_send + 1}`;
        console.log(`sending notification ${message}`);
        await updateAbandonedById(payload.id, {
            ["total_notification_send"]: payload.data.total_notification_send + 1,
            ["next_notification_at"]: payload.data.next_notification_at,
            ["notifications"]: [...payload.data.notifications, message],
            ["latest_notification_send_at"]: new Date()
            
        })
    })
    /*
        1: data is updated to DB, now can be used to send notification
        2: we can add the logic to send notification here
    */
    return CONSTANT.SUCCESS;
}

const sendNotification = async () => {
    const checkOutDetails = await getCheckOutDetails();
    if (checkOutDetails == CONSTANT.FAIL) {
        console.info(`Error in sending notification`);
        return;
    }
    const payloadToSendNotification = await getPendingOrders(checkOutDetails);
    await sendNotificationUtil(payloadToSendNotification);
}

const isNotificationRequired = async (notification_count, next_notification_at, documentId) => {
    if (notification_count >= CONSTANT.MAX_NOTIFICATION_COUNT) {
        // if have send the maximum notification then, we delete the document as no more notification
        // need to be send
        deleteCollectionById(documentId);
        return false;
    } else if (next_notification_at.toDate() > new Date()) {
        // Notification need to be send in future, so skipping in this cycle
        return false;
    }
    // yes need to send in this cycle
    return true;
}

module.exports = {
    getCustomerById,
    createAbandonedInDB,
    updateAbandonedById,
    sendNotification,
    deleteCollectionById,
};
