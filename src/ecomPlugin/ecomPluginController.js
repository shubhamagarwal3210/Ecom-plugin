const express = require('express');
const router = express.Router();
const ecomPluginServiceService = require('./ecomPluginService');
const { ERROR } = require('./errors');
const CONSTANT = require("./constant.json");


router.use(function (req, res, next) {
    console.log("Inside EcomPlugin Route");
    next();
  })


router.post('/webhook', async (req, res) => {
    const payload = req.body;
    const customer_id = payload?.customer?.id || payload?.order?.customer?.id;
    if (!customer_id) {
        console.log(`Customer Id was not found ${payload}`);
        res.send(CONSTANT.FAIL);
    }
    try {
        const customerDetails = await ecomPluginServiceService.getCustomerById(customer_id);
        if (payload.hasOwnProperty(CONSTANT.ABANDONED_CHECKOUT)) {
            let dbResponse;
            let today = new Date();
            let notification_count = 0;
            let checkoutPayload = {
                latest_abandoned_time: today,
                total_notification_send: notification_count,
                latest_notification_send_at: "",
                next_notification_at: new Date(today.getTime() + CONSTANT[notification_count + 1] * 1000),
            };
            if(customerDetails.length == 0) {
                // The customer is a new one, i.e no past entry 
                checkoutPayload.customer_id =  payload.customer.id;
                checkoutPayload.notifications =  [];
                checkoutPayload.line_items = [payload.line_items];              
                dbResponse = await ecomPluginServiceService.createAbandonedInDB(checkoutPayload);
            } else {
                // The old customer again abandoned
                const collection_id = customerDetails[0].id;
                checkoutPayload.line_items = [...customerDetails[0].data.line_items, payload.line_items];
                dbResponse = await ecomPluginServiceService.updateAbandonedById(collection_id,checkoutPayload);
            }
            return res.send(dbResponse);
        } else if (payload.hasOwnProperty(CONSTANT.ORDER_COMPLETED)) {
            if(customerDetails.length == 0) {
                // That is he/she has never abandoned or have purchased something, so do nothing
                console.log(`Customer never abandoned or have purchased something: ${payload}`);
                return res.send(CONSTANT.SUCCESS);
            }
            const document_id = customerDetails[0].id;
            // As they have ordered something so no need to send notification any more, so deleting
            dbResponse = await ecomPluginServiceService.deleteCollectionById(document_id);
            return res.send(dbResponse);
        }
        return res.send(CONSTANT.NO_MATCHING_EVENT);

    } catch (ex) {
        console.log(`Error in processing webhook : ${ex} body : ${payload}`);
        return res.send(ERROR.INTERNAL_SERVER_ERROR)
    }
})


module.exports = router;