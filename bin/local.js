'use strict'

// log on files
const logger = require('console-files')
// handle app authentication to Store API
// https://github.com/ecomclub/ecomplus-app-sdk
const { ecomAuth } = require('ecomplus-app-sdk')

ecomAuth.then(appSdk => {
  // configure setup for stores
  // list of procedures to save
  const procedures = require('./../lib/StoreApi/Procedures')
  appSdk.configureSetup(procedures, (err, { storeId }) => {
    if (!err) {
      logger.log('Setup store #' + storeId)
    } else {
      logger.error(err)
    }
  })
})

ecomAuth.catch(err => {
  logger.error(err)
  setTimeout(() => {
    // destroy Node process while Store API auth cannot be handled
    process.exit(1)
  }, 1000)
})
