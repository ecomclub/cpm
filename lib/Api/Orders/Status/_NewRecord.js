'use strict'

// log on files
// const logger = require('console-files')
// handle Store API errors
const errorHandling = require(process.cwd() + '/lib/Api/ErrorHandling')
// common handlers
const orderMainStatus = require('./_OrderMainStatus')

module.exports = ({ appSdk, storeId, auth }, order, fieldStatus, fieldRecords, fieldSubresource) => {
  // select last received status record by date
  let statusRecord
  order[fieldRecords].forEach(record => {
    if (record && (!statusRecord || record.updated_at >= statusRecord.updated_at)) {
      statusRecord = record
    }
  })

  // get current order status first
  const url = '/orders/' + order._id + '.json'
  const method = 'GET'
  const data = {}
  const noAuth = true

  // send public API request
  appSdk.apiRequest(storeId, url, method, data, auth, noAuth).then(({ response }) => {
    let orderBody = response.data
    // save current order status
    let lastStatusObject = orderBody[fieldStatus]
    let lastStatus
    if (lastStatusObject) {
      if (statusRecord.updated_at && lastStatusObject.updated_at >= statusRecord.updated_at) {
        // status already edited
        return
      } else {
        lastStatus = lastStatusObject.current
      }
    }

    // wait to check if status will be changed manually
    setTimeout(() => {
      // send authenticated API request to GET full order body
      appSdk.apiRequest(storeId, url, method, data, auth).then(({ response }) => {
        let orderBody = response.data
        let subresourceList = orderBody[fieldSubresource]
        if (!subresourceList && !subresourceList.length) {
          // no transactions or shipping lines ?
          return
        }
        // validate subresource ID if defined on status record object
        // 'transaction_id' or 'shipping_line_id'
        let subresourceId = statusRecord[fieldSubresource.slice(0, -1) + '_id']
        if (subresourceId && !subresourceList.find(obj => obj._id === subresourceId)) {
          // invalid transaction or shipping line ?
          return
        }

        // check if no new record was inserted
        let lastStatusRecord
        orderBody[fieldRecords].forEach(record => {
          if (record && (!lastStatusRecord || record.updated_at >= lastStatusRecord.updated_at)) {
            lastStatusRecord = record
          }
        })

        if (lastStatusRecord._id === statusRecord._id) {
          // current status record is the last
          if (!lastStatus || !orderBody[fieldStatus] || !orderBody[fieldStatus].current === lastStatus) {
            // main status not updated
            let current = statusRecord.current
            if (subresourceId && subresourceList.length > 1) {
              // can be partial status
              switch (current) {
                case 'paid':
                case 'refunded':
                case 'shippend':
                case 'delivered':
                  for (let i = 0; i < subresourceList.length; i++) {
                    let otherStatus = subresourceList[i].status
                    if (otherStatus && otherStatus.current !== current) {
                      current = 'partially_' + current
                      break
                    }
                  }
                  break
              }
            }

            // mount body to edit order object
            const method = 'PATCH'
            const data = {}
            data[fieldStatus] = {
              current,
              updated_at: statusRecord.updated_at || new Date().toISOString()
            }
            // handle new order main status
            data.status = orderMainStatus(Object.assign(orderBody, data))

            // send authenticated API request to edit order
            appSdk.apiRequest(storeId, url, method, data, auth).then(() => {
              if (subresourceId || subresourceList.length === 1) {
                // also updates subresource object
                // get current order main status first
                const url = '/orders/' + order._id + '/' +
                  fieldSubresource + '/' + subresourceId + '.json'
                const method = 'PATCH'
                const data = {
                  status: {
                    updated_at: statusRecord.updated_at,
                    current: statusRecord.current
                  }
                }

                // send public API request
                appSdk.apiRequest(storeId, url, method, data, auth).catch(errorHandling)
              }
            }).catch(errorHandling)
          }
        }
      }).catch(errorHandling)
    }, 60000)
  })
}