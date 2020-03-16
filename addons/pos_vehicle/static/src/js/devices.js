//(Roja 6-3-19)

odoo.define('pos_vehicle.devices', function (require) {
  "use strict";
  var devices = require('point_of_sale.devices');
  var db = require('point_of_sale.DB');
  var rpc = require('web.rpc');
  var core = require('web.core');
  var utils = require('web.utils');
  var round_pr = utils.round_precision;
  var _t = core._t;
  var PosBaseWidget = require('point_of_sale.BaseWidget');
  var gui = require('point_of_sale.gui');
  var field_utils = require('web.field_utils');
  var QWeb = core.qweb;


  devices.ProxyDevice.include({
    /*
     * ask the dot matrix printer to print the entry
     */
    print_receipt_entry: function (receipt, printer) {
      var self = this;
      if (receipt) {
        this.receipt_queue.push(receipt);
      }

      function send_printing_job() {
        if (self.receipt_queue.length > 0) {
          var r = self.receipt_queue.shift();
          self.message('print_dotmatrix', {
              receipt: r,
              printer: printer
            }, {
              timeout: 5000
            })
            .then(function () {
              send_printing_job();
            }, function (error) {
              if (error) {
                self.pos.gui.show_popup('error-traceback', {
                  'title': _t('Printing Error: ') + error.data.message,
                  'body': error.data.debug,
                });
                return;
              }
              self.receipt_queue.unshift(r);
            });
        }
      }
      send_printing_job();
    },

    /*
     * ask the printer to print a receipt
     */
    print_receipt: function (receipt, printer) {
      var self = this;
      if (receipt) {
        this.receipt_queue.push(receipt);
      }

      function send_printing_job() {
        if (self.receipt_queue.length > 0) {
          var r = self.receipt_queue.shift();
          console.log("R:" + r);
          self.message('print_xml_receipt', {
              receipt: r,
              printer: printer
            }, {
              timeout: 5000
            })
            .then(function () {
              send_printing_job();
            }, function (error) {
              if (error) {
                self.pos.gui.show_popup('error-traceback', {
                  'title': _t('Printing Error: ') + error.data.message,
                  'body': error.data.debug,
                });
                return;
              }
              self.receipt_queue.unshift(r);
            });
        }
      }
      send_printing_job();
    },

  });

});
