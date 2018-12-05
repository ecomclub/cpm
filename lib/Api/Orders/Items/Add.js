'use strict'

// log on files
// const logger = require('console-files')
// read configured app config data
const getConfig = require(process.cwd() + '/lib/Api/AppConfig')
// handle Store API errors
// const errorHandling = require(process.cwd() + '/lib/Api/ErrorHandling')
// MySQL database connection
const db = require(process.cwd() + '/lib/Database')
// common handlers
const updateProduct = require('./_UpdateProduct')

module.exports = (client, order, removeAll = false, appConfig) => {
  return new Promise(resolve => {
    const end = () => resolve(client, order, removeAll, appConfig)
    const fn = appConfig => {
      // decrease order items stock quantity
      if (order.items && appConfig.skip_add_order_items !== true) {
        let { storeId } = client
        ;(async function loop () {
          for (let i = 0; i < order.items.length; i++) {
            let item = order.items[i]

            await updateProduct(client, order, item, appConfig).then(() => {
              // insert into database
              let values = {
                store_id: storeId,
                order_id: order._id,
                item_id: item._id,
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.price
              }
              if (item.variation_id) {
                values.variation_id = item.variation_id
              }
              db.query('REPLACE INTO order_items SET ?', values)
            })
          }

          // all done
          end()
        }())
      } else {
        end()
      }
    }

    // call function with app config object
    appConfig ? fn(appConfig) : getConfig(client).then(fn)
  })
}