/* ---- Adding Vehicle details to the POS screens --- */


//-----------(Roja 25-9-18)-----------

odoo.define('pos_vehicle.models', function (require) {
  "use strict";
  var rpc = require('web.rpc');
  var models = require('point_of_sale.models');
  var _super_posmodel = models.PosModel.prototype;
  var _super_model = models.Orderline.prototype;
  var _super_ordermodel = models.Order.prototype;
  var db = require('point_of_sale.DB');
  var core = require('web.core');
  var _t = core._t;

  models.PosModel = models.PosModel.extend({
    // Added fields in model which are created backend
    initialize: function (session, attributes) {
      this.vehicles = {};
      this.set({
        'selectedVehicle': null,
      });

      // Forward the 'client' attribute on the selected order to 'selectedClient'
      function update_client() {
        //console.log("update client");
        var order = self.get_order();
        this.set('selectedClient', order ? order.get_client() : null);
      }
      return _super_posmodel.initialize.call(this, session, attributes);
    },
    // reload the list of vehicle or
    // updated vehicle
    load_new_vehicles: function () {
      var self = this;
      var def = new $.Deferred();
      var fields = _.find(this.models, function (model) {
        return model.model === 'pos.vehicle';
      }).fields;
      var domain = [
        ['write_date', '>', this.db.get_partner_write_date()]
      ];
      rpc.query({
          model: 'pos.vehicle',
          method: 'search_read',
          args: [domain, fields],
        }, {
          timeout: 3000,
          shadow: true,
        })
        .then(function (vehicles) {
          for (var i = 0, len = vehicles.length; i < len; i++) {
            //console.log("vehhhhload:"+vehicles[i]);
            self.db.vehicles[vehicles[i].id] = vehicles[i];
          }
          if (vehicles) {
            self.db.generate_search_string();
          }
        }, function (type, err) {});


    },


    load_new_partners: function () {
      var self = this;
      var def = new $.Deferred();
      var fields = _.find(this.models, function (model) {
        return model.model === 'res.partner';
      }).fields;
      var domain = [
        ['customer', '=', true],
        ['write_date', '>', this.db.get_partner_write_date()]
      ];
      rpc.query({
          model: 'res.partner',
          method: 'search_read',
          args: [domain, fields],
        }, {
          timeout: 3000,
          shadow: true,
        })
        .then(function (partners) {
          if (self.db.add_partners(partners)) { // check if the partners we got were real updates
            def.resolve();
          } else {
            def.reject();
          }
        }, function (type, err) {
          def.reject();
        });

      return def;
    },
    // return the current vehicle
    get_vehicle: function () {
      var order = this.get_order();
      if (order) {
        return order.get_vehicle();
      }
      return null;
    },
    //removes the current order
    delete_current_order: function () {
      var order = this.get_order();
      //console.log("delete");
      if (order) {
        order.destroy({
          'reason': 'abandon'
        });

      }
    },

  });
  models.load_models([{
    model: 'product.classification',
    fields: [],
    domain: [],
    context: {},
    loaded: function (self, classfication) {
      self.classfication = classfication;
      for (var i = 0, len = classfication.length; i < len; i++) {
        self.db.classfication.push(classfication[i]);
        self.db.product_classfication[classfication[i].id] = classfication[i];
      }
    }
  }]);
  models.load_models([{
    model: 'pos.vehicle',
    fields: ['id', 'vehicle_number', 'customer_name'],
    domain: null,
    context: {},
    loaded: function (self, vehicles) {
      self.vehicles = vehicles;
      for (var i = 0, len = vehicles.length; i < len; i++) {
        self.db.vehicles[vehicles[i].id] = vehicles[i];
      }
      if (vehicles) {
        self.db.generate_search_string();
      }
    }
  }]);
  models.load_models([{
    model: 'pos.printers',
    fields: [],
    domain: [],
    context: {},
    loaded: function (self, printers) {
      self.printers = printers;
      for (var i = 0, len = printers.length; i < len; i++) {
        //console.log("Printers:"+printers[i].name);
        if (printers[i].is_receipt_entry_printer) {
          self.db.receipt_printer.push(printers[i]);
        }
        self.db.printers[printers[i].id] = printers[i];
      }
    }
  }]);
  models.load_fields("pos.session", ['shift_id']);
  //models.load_fields("res.partner", ['vehicle_no', 'mobile','alias_name']);
  models.load_fields("res.partner", ['vehicle_no', 'mobile']);
  models.load_fields("pos.config", ['bill_sequence']);
  models.load_fields("account.tax", ['description']);
  models.load_fields("res.company", ['currency_id', 'email', 'website', 'company_registry', 'vat', 'name', 'phone', 'partner_id', 'country_id', 'tax_calculation_rounding_method', 'city', 'street', 'street2', 'zip', 'state_id', 'tin']);
  models.Order = models.Order.extend({
    initialize: function (attributes, options) {
      _super_ordermodel.initialize.call(this, attributes, options);
      this.name = this.uid;
      this.can_sale = false;
    },
    get_vehicle_number: function () {

      var order = this.pos.get_order();
      var client = order.get('client');
      return client ? client.vehicle_number : "";

    },
    get_bill_number: function () {
      return this.pos.config.name + "/" + this.pos.pos_session.id + "/" + this.pos.pos_session.login_number + "/" + this.sequence_number;
    },
    //get_bill_number: function(){
    //var bill_sequence = this.pos.config.bill_sequence;
    //console.log("bill:"+bill_sequence);
    //return bill_sequence ;
    //},
    init_from_JSON: function (json) {
      var client;
      this.sequence_number = json.sequence_number;
      //this.device_sequence =json.device_sequence;
      //this.bill_sequence =json.bill_sequence;
      this.pos.pos_session.sequence_number = Math.max(this.sequence_number + 1, this.pos.pos_session.sequence_number);
      this.session_id = json.pos_session_id;
      this.uid = json.uid;
      this.name = _t("Order ") + this.uid;
      this.validation_date = json.creation_date;

      if (json.fiscal_position_id) {
        var fiscal_position = _.find(this.pos.fiscal_positions, function (fp) {
          return fp.id === json.fiscal_position_id;
        });

        if (fiscal_position) {
          this.fiscal_position = fiscal_position;
        } else {
          console.error('ERROR: trying to load a fiscal position not available in the pos');
        }
      }

      if (json.pricelist_id) {
        this.pricelist = _.find(this.pos.pricelists, function (pricelist) {
          return pricelist.id === json.pricelist_id;
        });
      } else {
        this.pricelist = this.pos.default_pricelist;
      }

      if (json.partner_id) {
        client = this.pos.db.get_partner_by_id(json.partner_id);
        //console.log("json:"+json.partner_vehicle_id);
        if ((client) && (json.partner_vehicle_id) && (json.partner_vehicle_id != 0)) {
          var vehicle = this.pos.db.get_vehicle_number(parseInt(json.partner_vehicle_id));
          client.vehicle_number = vehicle.vehicle_number;
          client.vehicle_id = vehicle.id;
        }
        if (!client) {
          console.error('ERROR: trying to load a parner not available in the pos');
        }
      } else {
        client = null;
      }
      this.set_client(client);

      this.temporary = false; // FIXME
      this.to_invoice = false; // FIXME
      this.can_sale = false; // Intialize can_sale

      var orderlines = json.lines;
      if (orderlines) {
         console.log("order");
      }
      for (var i = 0; i < orderlines.length; i++) {
        var orderline = orderlines[i][2];
        this.add_orderline(new models.Orderline({}, {
          pos: this.pos,
          order: this,
          json: orderline
        }));
      }

      var paymentlines = json.statement_ids;
      for (var i = 0; i < paymentlines.length; i++) {
        var paymentline = paymentlines[i][2];
        var newpaymentline = new models.Paymentline({}, {
          pos: this.pos,
          order: this,
          json: paymentline
        });
        this.paymentlines.add(newpaymentline);

        if (i === paymentlines.length - 1) {
          this.select_paymentline(newpaymentline);
        }
      }
    },
    set_order_date: function (date) {
      console.log("date:" + date);
      this.set('order_date', date);
    },
    get_order_date: function () {
      var order_date_ist = this.get('order_date') + " GMT";
      var billdate = new Date(order_date_ist);
      console.log("order_Date:" + billdate.toLocaleString());
      return billdate.toLocaleString()
    },
    set_order_ref: function (ref) {
      console.log("Order ref set:" + ref);
      this.set('order_ref', ref);
    },


    get_order_ref: function () {
      return this.get('order_ref');
    },
    //Sets can_sale 
    set_can_sale: function (can_sale) {
      this.assert_editable();
      this.can_sale = can_sale;
    },
    //Returns whether the sale is can_sale 
    is_can_sale: function () {
      return this.can_sale;
    },
    set_client: function (client) {
      this.assert_editable();
      if ((client) && (client.vehicle_id)) {
        this.set_vehicle(client.vehicle_id); //Sets the vehicle number of the client
      } else {
        this.set_vehicle(null);
      }
      this.set('client', client);
    },
    get_client: function () {
      return this.get('client');
    },
    //Sets current vehicle of the customer
    set_vehicle: function (vehicle) {
      this.assert_editable();
      // console.log("vehh:"+vehicle);
      this.set('vehicle', vehicle);
    },
    //Returns current vehicle of the customer
    get_vehicle: function () {
      return this.get('vehicle');
    },
    get_orders_line: function (orders) {
      var order = [];
      for (var i = 0; i < orders.length; i++) {
        var unit_name = orders[i].unit_name;
        var product_qty = 0;
        if (unit_name === "Unit(s)") {
          unit_name = '';
        }
        if (orders[i].remove_trailing_zeros) {
          product_qty = (orders[i].quantity).toFixed(4) * 1;
        } else {
          product_qty = (orders[i].quantity).toFixed(4);
        }
        var x = 35 - (String(product_qty).length + unit_name.length);
        if (orders[i].product_name.length > x) {
          var productname = orders[i].product_name.substr(0, x - 1);
        } else {
          var productname = orders[i].product_name;
        }
        var space = 35 - ((String(product_qty).length) + unit_name.length + (productname.length));
        var emp = ' ';
        var uprice = (orders[i].price).toFixed(this.pos.currency.decimals);
        var price = (orders[i].price_display).toFixed(this.pos.currency.decimals);
        var s = 10 - (String(uprice).length);
        var upri = Array(s + 1).join(" ") + String(uprice);
        var s1 = 17 - (String(price).length);
        var tpri = Array(s1 + 1).join(" ") + String(price);
        var line = product_qty + unit_name + Array(space + 1).join(" ") + productname;
        order.push({
          'line': line,
          'uamt': upri,
          'tamt': tpri
        });
      }

      return order;
    },
    get_footer_lines: function (cashier, total) {
      var tot = total ? String((total).toFixed(this.pos.currency.decimals)) : total;
      var space = 56 - ((cashier.length) + (tot.length));
      //console.log("space:" +','+tot+','+parseInt(space));
      var emp = ' ';
      return Array(7).join(" ") + cashier + Array(parseInt(space) + 1).join(" ") + tot;
    },
    get_pos_shift: function () {
      var session = this.pos.pos_session;
      var shift_name = session['shift_id'][1];
      shift_name = shift_name.replace(/^Shift+/i, '');
      return shift_name;
    },
    get_shift_date_part: function (shift_id, payment) {
      var self = this;
      var pay = payment || 'Credit';
      var total = 27;
      var combine = shift_id + '  ' + pay;
      var space = total - combine.length;
      if (combine.length < total) {
        combine += Array(space + 1).join(" ");
      }
      return combine;
    },
    export_for_printing: function () {
      var orderlines = [];
      var self = this;

      this.orderlines.each(function (orderline) {
        orderlines.push(orderline.export_for_printing());
      });

      var paymentlines = [];
      this.paymentlines.each(function (paymentline) {
        paymentlines.push(paymentline.export_for_printing());
      });

      orderlines = orderlines.sort(function (a, b) {
        return a.sequence - b.sequence;
      });

      var client = this.get('client');
      var cashier = this.pos.cashier || this.pos.user;
      var company = this.pos.company;
      var shop = this.pos.shop;
      var date = new Date();

      function is_xml(subreceipt) {
        return subreceipt ? (subreceipt.split('\n')[0].indexOf('<!DOCTYPE QWEB') >= 0) : false;
      }

      function render_xml(subreceipt) {
        if (!is_xml(subreceipt)) {
          return subreceipt;
        } else {
          subreceipt = subreceipt.split('\n').slice(1).join('\n');
          var qweb = new QWeb2.Engine();
          qweb.debug = core.debug;
          qweb.default_dict = _.clone(QWeb.default_dict);
          qweb.add_template('<templates><t t-name="subreceipt">' + subreceipt + '</t></templates>');

          return qweb.render('subreceipt', {
            'pos': self.pos,
            'widget': self.pos.chrome,
            'order': self,
            'receipt': receipt
          });
        }
      }

      var receipt = {
        orderlines: orderlines,
        gap: " ",
        paymentlines: paymentlines,
        subtotal: this.get_subtotal(),
        total_with_tax: this.get_total_with_tax(),
        total_without_tax: this.get_total_without_tax(),
        total_tax: this.get_total_tax(),
        total_paid: this.get_total_paid(),
        total_discount: this.get_total_discount(),
        tax_details: this.get_tax_details(),
        change: this.get_change(),
        name: this.get_name(),
        space: Array(14).join(" "),
        width: 10,
        shift_id: this.get_pos_shift(),
        client: client ? client.name : null,
        invoice_id: null, //TODO
        cashier: cashier ? this.get_wrapped_name(cashier.name) : null,
        precision: {
          price: 2,
          money: 2,
          quantity: 3,
        },
        date: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          date: date.getDate(), // day of the month
          day: date.getDay(), // day of the week
          hour: date.getHours(),
          minute: date.getMinutes(),
          sec: date.getSeconds(),
          isostring: date.toISOString(),
          localestring: date.toLocaleString(),
        },
        company: {
          email: company.email,
          website: company.website,
          company_registry: company.company_registry,
          contact_address: company.partner_id[1],
          vat: company.tin,
          name: company.name,
          phone: company.phone,
          logo: this.pos.company_logo_base64,
          street: company.street,
          street2: company.street2,
          city: company.city,
          zip: company.zip,
          state_name: company.state_id,
          country_name: company.country_id,
          gstin: company.vat,
        },
        shop: {
          name: shop.name,
        },
        customer: {
          name: client ? this.get_wrapped_name(client.name, 34) : null,
          wrapped_name: client ? this.get_wrapped_name(client.name, 30) : null,
          //alias_name: client ? client.alias_name : null,
          vat: client ? client.vat : null,
          street: client ? client.street : null,
          street2: client ? client.street2 : null,
          city: client ? client.city : null,
          zip: client ? client.zip : null,
          state_name: client ? client.state_id : null,
          country_name: client ? client.country_id : null,
        },
        currency: this.pos.currency,
        creation_date: this.creation_date,
        session_name: this.pos.pos_session.name,
        vehicle_no: this.get_vehicle_number(),
        payment: paymentlines[0] ? this.get_mode_of_payment(paymentlines[0]) : null,
        shift_date_part: this.get_shift_date_part(this.get_pos_shift(), (paymentlines[0] ? this.get_mode_of_payment(paymentlines[0]) : null)),
        shift_part: this.get_shift_part(this.get_pos_shift(), (paymentlines[0] ? this.get_mode_of_payment(paymentlines[0]) : null), moment(this.get_order_date()).format('DD-MM-YYYY')),
        // bill_no: this.bill_sequence,
        bill_no: this.get_order_ref(),
        bill_part: this.get_bill_part(this.get_order_ref()),
        customer_part: this.get_customer_part((client ? this.get_wrapped_name(client.name) : null), this.get_vehicle_number()),
        bill_time_part: this.get_bill_time_part((this.get_order_ref()), moment().format('hh:mm a')),
        bill_date: this.get_order_date(),
        lines: orderlines.length <= 4 ? this.get_orders_line(orderlines) : null,
        wrap_orderlines: orderlines.length > 4 ? this.wrap_order(this.get_orders_line(orderlines)) : null,
        header_gst_part: this.get_gst_part(company.vat),
        footer_lines: this.get_footer_lines(this.get_wrapped_name(cashier.name, 18), this.get_total_with_tax()),
        breaks: this.get_break_lines(orderlines, this.get_tax_details()),
        header_products: this.get_report_product_header(),
        header_pro_count: 10,
        orderlines_entry: this.get_orderlines_entry(orderlines),
        printer_config: this.get_printer(),
        receipt_entry_printer_config: this.get_receipt_printer(),
        vehicle_id: this.get_vehicle(),
      };
      receipt.header = this.pos.config.receipt_header || '';
      receipt.footer = this.pos.config.receipt_footer || '';
      console.log("bill number :" + receipt.bill_no + "," + moment().format('hh:mm a'));

      return receipt;
    },
    get_receipt_printer: function () {
      var self = this;
      var receipt_printer = self.pos.db.receipt_printer[0];
      //console.log("Receipt printer:"+Object.entries(receipt_printer));
      return {
        'vendor_id': receipt_printer ? receipt_printer['vendor_id'] : null,
        'product_id': receipt_printer ? receipt_printer['product_id']:null,
        'ip': receipt_printer ? receipt_printer['proxy_ip']: null,
      };
    },
    get_printer: function () {
      var self = this;
      var printer_id = this.pos.config.printer[0];
      if (printer_id) {
        var printer_config = self.pos.db.get_printer_config_by_id(printer_id);
        //console.log("printer_config:"+Object.entries(printer_config));
        return {
          'vendor_id': printer_config['vendor_id'],
          'product_id': printer_config['product_id'],
          'type': printer_config['printer_type'],
        };
      } else {
        return false;
      }
    },
    get_orderlines_entry: function (orderlines) {
      var self = this;
      var classified_orderlines = {};
      var sortable = [];
      var pro = self.pos.db.get_product_classification();
      var pro_class = self.pos.db.product_classfication;
      /* Setting default value for the classified orderlines dictionary*/
      for (var m = 0; m < pro.length; m++) {
        console.log("child:" + (pro[m]['child_id']).length);
        if (pro[m]['child_id'].length == 0) {
          var key = {
            'qty': 0.0,
            'amt': 0.0,
            'seq': pro[m]['sequence'],
            'width': pro[m]['width'],
            'remove_trailing_zeros': pro[m]['remove_trailing_zeros']
          };
          classified_orderlines[pro[m]['name']] = key;
        }

      }
      for (var i = 0; i < orderlines.length; i++) {
        if (orderlines[i].classification) {
          var classification_name = orderlines[i].classification[1];
          classification_name = classification_name.substring(classification_name.indexOf('/')+1).trim();
          classified_orderlines[classification_name.trim()]['qty'] += orderlines[i].quantity;
          classified_orderlines[classification_name.trim()]['amt'] += orderlines[i].price_display;
        }
      }
      for (var key in classified_orderlines) {
        if (classified_orderlines.hasOwnProperty(key)) {
          sortable.push([classified_orderlines[key]]);
        }
      }
      sortable.sort(function (a, b) {
        return a.seq - b.seq;
      });
      //console.log("sequence:"+Object.entries(sortable));
      return sortable;
    },
    get_report_product_header: function () {
      var self = this;
      var pro_class = self.pos.db.product_classfication;
      return pro_class;
    },
    get_break_lines: function (orderlines, tax) {
      var breaklines = null;
      if (orderlines.length <= 4) {
        breaklines = Array(7 - ((orderlines.length) + (tax.length))).join('1').split('');

      }
      return breaklines;
    },
    wrap_order: function (line) {
      var self = this;
      //console.log("Liness:"+(line));
      var size = 4;
      var n = 0;
      var first = true;
      var wrap_lines = {
        'first': [],
        'other': [],
        'last': []
      };
      var footer = this.get_footer_lines('Carry Over', '');
      while (n != line.length) {
        var items = line.slice(n, n + size);
        if (first) {
          var breaks = self.get_break_lines(items, []);
          //console.log("fbreaks:"+breaks.length);
          for (var i = 0; i < items.length; i++) {
            wrap_lines['first'].push(items[i]);
          }
          wrap_lines['first']['breaks'] = breaks;
          wrap_lines['first']['footer'] = footer;
          first = false;
        } else {
          if (items.length == size) {
            //console.log("pushing other");
            wrap_lines['other'].push(items);
            wrap_lines['other']['footer'] = footer;
          } else {
            //console.log("pushing last");
            var breaks = self.get_break_lines(items, this.get_tax_details());
            for (var i = 0; i < items.length; i++) {
              wrap_lines['last'].push(items[i]);
            }
          }
          //console.log("lbreaks:"+breaks.length);
          wrap_lines['last']['breaks'] = breaks;

        }
        n += items.length;
      }
      //console.log("wrap_lines['first']:" +wrap_lines['first']);
      return wrap_lines;
    },
    get_customer_part: function (customer, vehicle) {
      var tot_char = Array(144).join(" ");
      var cus_len = customer ? customer.length : 0;
      var veh_len = vehicle ? vehicle.length : 0;
      var output = [tot_char.slice(0, 15), customer, '  ', vehicle, tot_char.slice(15 + cus_len + 2 + veh_len, 91), customer, '  ', vehicle, tot_char.slice(91 + cus_len + 2 + veh_len)].join('');
      return output;
    },
    get_gst_part: function (gst_no) {
      var gst = 'GSTIN:' + gst_no;
      var tot_char = Array(144).join(" ");
      var output = [tot_char.slice(0, 9), gst, tot_char.slice(9 + gst.length, 83), gst, tot_char.slice(83 + gst.length)].join('');
      return output;
    },
    destroy: function () {
      Backbone.Model.prototype.destroy.apply(this, arguments);
      $('.pos-switchbuttons').find('.count').css("visibility", "hidden");
      this.pos.db.remove_unpaid_order(this);
    },
    generate_unique_bill: function () {
      var date = new Date();
      var ubill = (this.pos.config.name) + '/' + (date.getMonth() + 1) + (date.getFullYear().toString().substr(-2)) + '/' + (this.get_bill_number() + 1);
      //console.log("ubill:"+ubill);
      return ubill;
    },
    get_bill_time_part: function (bill_no, datetime) {
      var tot_char = Array(144).join(" ");
      var self = this;
      var date_obj = new Date();
      var time = String(moment().format('hh:mm a'));
      var bill = this.get_bill_part(bill_no);
      var output = [tot_char.slice(0, 18), bill, time, tot_char.slice(18 + bill.length + time.length, 92), bill, time, tot_char.slice(92 + bill.length + time.length)].join('');
      return output;
    },
    get_shift_part: function (shift_id, pay, day) {
      var self = this;
      var date_obj = new Date();
      var date = String(date_obj.getDate()) + "-" + String(date_obj.getMonth() + 1) + "-" + String(date_obj.getFullYear());
      var shift_pay = this.get_shift_date_part(shift_id, pay);
      var tot_char = Array(144).join(" ");
      var output = [tot_char.slice(0, 14), shift_pay, date, tot_char.slice(14 + shift_pay.length + date.length, 88), shift_pay, date, tot_char.slice(88 + shift_pay.length + date.length)].join('');
      return output;
    },
    get_bill_part: function (bill_no) {
      var self = this;
      var bill = bill_no || ' ';
      var total = 24;
      var spc = total - String(bill).length;
      var output = null;
      if (bill.length < total) {
        var gap = Array(spc).join(" ");
        output = bill + gap;
      }
      //console.log("Bill length:" +output.length);
      return output;
    },
    get_mode_of_payment: function (payment) {
      //console.log("Payment:"+Object.entries(payment));
      var payment_mode = payment.journal
      payment_mode = payment_mode.replace(' (INR)', '');
      return payment_mode;
    },
    get_wrapped_name: function (name, len) {
      if (name) {
        if (name.length > len) {
          var wrapped_name = name.substr(0, len - 2) + "..";
        } else {
          var wrapped_name = name;
        }
      }
      return wrapped_name;
    },
    get_tax_details: function () {
      var details = {};
      var fulldetails = [];
      this.orderlines.each(function (line) {
        var ldetails = line.get_tax_details();
        for (var id in ldetails) {
          if (ldetails.hasOwnProperty(id)) {
            details[id] = (details[id] || 0) + ldetails[id];
          }
        }
      });
      for (var id in details) {
        if (details.hasOwnProperty(id)) {
          var amt = String(details[id].toFixed(this.pos.currency.decimals));
          var fspace = 35 - (this.pos.taxes_by_id[id].description.length);
          var espace = 26 - String(amt.length);
          var emp = ' ';

          var tax_line = Array(fspace + 1).join(" ") + (this.pos.taxes_by_id[id].description);
          var tax_amt = Array(espace + 1).join(" ") + amt;
          fulldetails.push({
            amount: details[id],
            tax: this.pos.taxes_by_id[id],
            name: this.pos.taxes_by_id[id].name,
            description: this.pos.taxes_by_id[id].description,
            line: tax_line,
            amt: tax_amt
          });
        }
      }
      return fulldetails;
    },
    export_as_JSON: function () {
      var orderLines, paymentLines;
      orderLines = [];
      //console.log("bill exp:"+this.sequence_number);
      this.orderlines.each(_.bind(function (item) {
        return orderLines.push([0, 0, item.export_as_JSON()]);
      }, this));
      paymentLines = [];
      this.paymentlines.each(_.bind(function (item) {
        return paymentLines.push([0, 0, item.export_as_JSON()]);
      }, this));
      return {
        name: this.get_name(),
        amount_paid: this.get_total_paid(),
        amount_total: this.get_total_with_tax(),
        amount_tax: this.get_total_tax(),
        amount_return: this.get_change(),
        lines: orderLines,
        statement_ids: paymentLines,
        pos_session_id: this.pos_session_id,
        pricelist_id: this.pricelist ? this.pricelist.id : false,
        partner_id: this.get_client() ? this.get_client().id : false,
        partner_vehicle_id: this.get_vehicle() ? this.get_vehicle() : false, //exporting current vehicle 
        user_id: this.pos.get_cashier().id,
        is_can_sale: this.is_can_sale() ? this.is_can_sale() : false, //exporting can_sale field
        uid: this.uid,
        sequence_number: this.sequence_number,
        creation_date: this.validation_date || this.creation_date, // todo: rename creation_date in master
        fiscal_position_id: this.fiscal_position ? this.fiscal_position.id : false,
        //bill_sequence : this.get_bill_number(),
        //device_sequence : this.generate_unique_bill(),
        //device_sequence : this.get_bill_number(),
      };
    },
  });
  models.Orderline = models.Orderline.extend({
    initialize: function (session, attributes) {
      this.sequence = 10;
      this.pos = attributes.pos;
      //this.pos_session_id = this.pos.pos_session.id;
      //this.attributes=attributes;
      this.pos_config_id = this.pos.pos_session.config_id;
      var tn = [];
      return _super_model.initialize.call(this, session, attributes);
    },
    get_sequence: function () {
      return this.sequence;
    },
    export_as_JSON: function () {
      var orderline_data = _super_model.export_as_JSON.call(this);
      $.extend(orderline_data, {
        'sequence': this.sequence
      })
      return orderline_data
    },

    export_for_printing: function () {
      var id = this.get_product().taxes_id;


      return {

        quantity: this.get_quantity(),
        unit_name: this.get_unit().name,
        price: this.get_unit_display_price(),
        discount: this.get_discount(),
        product_name: this.get_product().display_name,
        product_name_wrapped: this.generate_wrapped_product_name(),
        price_display: this.get_display_price(),
        price_with_tax: this.get_price_with_tax(),
        price_without_tax: this.get_price_without_tax(),
        tax: this.get_tax(),
        tax_id: this.get_product().taxes_id,
        remove_trailing_zeros: this.get_product().remove_trailing_zeros,
        product_description: this.get_product().description,
        product_description_sale: this.get_product().description_sale,
        l10n_in_hsn_code: this.get_product().l10n_in_hsn_code,
        sequence: this.get_sequence(),
        get_quantity_str_with_unit: this.get_quantity_str_with_unit(),
        classification: this.get_product().product_classification_id,
      };

    },

  });
});
