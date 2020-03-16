/* ---- Adding Vehicle details to the POS screens --- */
function post_vehicle_number(s, id) {
  document.getElementById(id).value = s;
  if (id == "number") {
    $('#number').trigger("keypress");
  }
}


//-----------(Roja 25-9-18)-----------


odoo.define('pos_vehicle.screens', function (require) {
  "use strict";
  var screens = require('point_of_sale.screens');
  var models = require('point_of_sale.models');
  var db = require('point_of_sale.DB');
  var rpc = require('web.rpc');
  var core = require('web.core');
  var utils = require('web.utils');
  var round_pr = utils.round_precision;
  var _t = core._t;
  var PosBaseWidget = require('point_of_sale.BaseWidget');
  var gui = require('point_of_sale.gui');
  var models = require('point_of_sale.models');
  var field_utils = require('web.field_utils');
  var QWeb = core.qweb;
  var sunmi = navigator.javaEnabled();
  /*--------------------------------------*\
   |         THE CLIENT LIST              |
  \*======================================*/

  // The clientlist displays the list of vehicles and its customers ,
  // and allows the cashier to create, edit and assign
  // customers and vehicles.

  screens.ClientListScreenWidget.include({

    show: function () {
      var self = this;
      this._super();

      this.renderElement();
      this.details_visible = false;
      this.old_client = this.pos.get_order().get_client();
      this.old_vehicle = this.pos.get_order().get_vehicle(); //get old vehicle
      this.$('.back').click(function () {
        self.gui.back();
      });

      this.$('.next').click(function () {
        self.save_changes();
        self.gui.back(); // FIXME HUH ?
      });
      this.$('#open_cam').click(function () {
        AndroidInterface.print_check1('number');

      });
      this.$('#search,#user').click(function () {
        $('.back,.new-customer,.cus_search').css({
          "visibility": "hidden",
          "opacity": "0"
        });
        $('.searchbox').css("visibility", "visible");
      });

      this.$('.new-customer').click(function () {
        self.display_client_details('edit', {
          'country_id': self.pos.company.country_id,
        });
      });

      var partners = this.pos.db.get_partners_sorted(1000);
      this.render_list(partners);

      this.reload_partners();
      if (this.old_client) {
        if ((this.old_vehicle) && (this.old_vehicle != 0)) { //add vehicle to the customer if has
          var vehicle = this.pos.db.get_vehicle_number(parseInt(this.old_vehicle));
          this.old_client.vehicle_id = vehicle.id;
          this.old_client.vehicle_number = vehicle.vehicle_number;
          var cache_key = self.calculate_cache_key(this.old_client);
          this.old_client.cache = cache_key;
        }
        this.display_client_details('show', this.old_client, 0);
      }

      this.$('.client-list-contents').delegate('.client-line', 'click', function (event) {
        self.line_select(event, $(this), ($(this).data('id')));
      });

      var search_timeout = null;

      if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
        this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
      }

      this.$('.searchbox input').on('keypress', function (event) {
        clearTimeout(search_timeout);
        var searchbox = this;

        search_timeout = setTimeout(function () {
          self.perform_search(searchbox.value.replace(/ /g, '', '.'), event.which === 13);
        }, 70);

      });

      this.$('.searchbox .search-clear').click(function () {
        self.clear_search();
        $('.back,.new-customer,.cus_search').css({
          "visibility": "visible",
          "opacity": "1"
        });
        $('.searchbox').css("visibility", "hidden");
      });
    },


    line_select: function (event, $line, id) {
      //spliting partner_id,vehicle_id from line id
      console.log("Line select:" + (id));
      var ids = id.split(",");
      var partner = this.pos.db.get_partner_by_id(parseInt(ids[0]));
      if ((parseInt(ids[1])) != 0) { //adding current vehicle details to the customer if has
        var vehicle = this.pos.db.get_vehicle_number(parseInt(ids[1]));
        partner.vehicle_number = vehicle.vehicle_number;
        partner.vehicle_id = vehicle.id;
        partner.cache = id;
      }
      this.$('.client-list .lowlight').removeClass('lowlight');
      if ($line.hasClass('highlight')) {
        $line.removeClass('highlight');
        $line.addClass('lowlight');
        this.display_client_details('hide', partner);
        this.new_client = null;
        this.toggle_save_button();
      } else {
        this.$('.client-list .highlight').removeClass('highlight');
        $line.addClass('highlight');
        var y = event.pageY - $line.parent().offset().top;
        this.display_client_details('show', partner, y);
        this.new_client = partner;
        this.toggle_save_button();
      }
    },
    // ui handle for the 'edit selected customer' action
    edit_client_details: function (partner) {
      this.display_client_details('edit', partner);
    },
    save_changes: function () {
      var order = this.pos.get_order();
      if (this.has_client_changed()) {
        var default_fiscal_position_id = _.findWhere(this.pos.fiscal_positions, {
          'id': this.pos.config.default_fiscal_position_id[0]
        });
        if (this.new_client) {
          order.fiscal_position = _.findWhere(this.pos.fiscal_positions, {
            'id': this.new_client.property_account_position_id[0]
          });
          order.set_pricelist(_.findWhere(this.pos.pricelists, {
            'id': this.new_client.property_product_pricelist[0]
          }) || this.pos.default_pricelist);
        } else {
          order.fiscal_position = default_fiscal_position_id;
          order.set_pricelist(this.pos.default_pricelist);
        }
        order.set_client(this.new_client);
        if (this.new_client) {
          var vehicle_no = this.new_client.vehicle_number;
          $('#action_vehicle_no').text(vehicle_no ? vehicle_no : null);
        }
        //this.actionpad = new screens.ActionpadWidget(this,{});
        //this.actionpad.renderElement();
      }
    },

    has_client_changed: function () {
      var old_vehicle = this.pos.get_order().get_vehicle();
      if (this.old_client && this.new_client) {
        //checking the old client with new client having vehicle as a factor 
        if (parseInt(this.old_vehicle) == this.new_client.vehicle_id) {
          console.log("false");
          return false;
        } else {
          return true;
        }
      } else {
        return !!this.old_client !== !!this.new_client;
      }
    },


    //Generates unique cache key by combining client_id with vehicle_id
    calculate_cache_key: function (client) {
      return client.id + ',' + client.vehicle_id;
    },
    //Creation of client line for every vehicle
    render_partner: function (partner) {
      var cache_key = this.calculate_cache_key(partner);
      var old_vehicle = this.pos.get_order().get_vehicle();
      partner.cache = cache_key;
      var clientline = this.partner_cache.get_node(cache_key);
      if (!clientline) {
        var clientline_html = QWeb.render('ClientLine', {
          widget: this,
          partner: partner
        });
        var clientline = document.createElement('tbody');
        clientline.innerHTML = clientline_html;
        clientline = clientline.childNodes[1];
        this.partner_cache.cache_node(cache_key, clientline);
      }
      if (partner === this.old_client) {
        if ((partner.vehicle_id) && (this.old_vehicle)) {
          if (parseInt(partner.vehicle_id) === parseInt(this.old_vehicle)) { //highlighting of customer's current vehicle line
            clientline.classList.add('highlight');
          } else {
            clientline.classList.remove('highlight');
          }
        } else {
          clientline.classList.add('highlight');
        }
      } else {
        clientline.classList.remove('highlight');
      }
      return clientline;
    },
    perform_search: function (query, associate_result) {
      var customers;
      if (query) {
        customers = this.pos.db.search_partner(query);
        this.display_client_details('hide');
        if (associate_result && customers.length === 1) {
          this.new_client = customers[0];
          this.save_changes();
          this.gui.back();
        }
        this.render_list(customers);
      } else {
        customers = this.pos.db.get_partners_sorted();
        this.render_list(customers);
      }
    },

    render_list: function (partners) {
      var contents = this.$el[0].querySelector('.client-list-contents');
      contents.innerHTML = "";
      for (var i = 0, len = Math.min(partners.length, 1000); i < len; i++) {
        var partner = partners[i];
        if (partner.vehicle_no.length > 0) { //Client line is created for every vehicle a customer has
          for (var j = 0, len1 = (partner.vehicle_no.length); j < len1; j++) {
            var vehicle_number = this.pos.db.get_vehicle_number(partner.vehicle_no[j]);
            partner.vehicle_id = vehicle_number.id;
            partner.vehicle_number = vehicle_number.vehicle_number;
            var clientline = this.render_partner(partner);
            contents.appendChild(clientline);
          }
        } else {
          partner.vehicle_id = 0;
          partner.vehicle_number = "";
          var clientline = this.render_partner(partner);
          contents.appendChild(clientline);
        }

      }
    },
    reload_partners: function () {
      var self = this;
      self.pos.load_new_vehicles(); //loading of new vehicles if it is created/edited
      return this.pos.load_new_partners().then(function () {
        self.partner_cache = new screens.DomCache(); //clering cache after customer/vehicle creation/updation
        self.render_list(self.pos.db.get_partners_sorted(1000));
        // update the currently assigned client if it has been changed in db.
        var curr_client = self.pos.get_order().get_client();
        //console.log("curr:"+Object.entries(curr_client));
        if (curr_client) {
          self.pos.get_order().set_client(self.pos.db.get_partner_by_id(curr_client.id));
        }
      });
    },
    saved_client_details: function (partner_id, vehicle_id) {
      var self = this;
      this.reload_partners().then(function () {
        //console.log("saved:");
        var partner = self.pos.db.get_partner_by_id(partner_id);
        var vehicle = self.pos.db.get_vehicle_number(vehicle_id);
        if (partner) {
          self.pos.db.generate_search_string();
          if (vehicle) { //associates partner with vehicle if has
            partner.vehicle_id = vehicle.id;
            partner.vehicle_number = vehicle.vehicle_number;
          }
          self.new_client = partner;
          self.toggle_save_button();
          var cache_key = self.calculate_cache_key(partner);
          partner.cache = cache_key;
          self.display_client_details('show', partner);
        } else {
          // should never happen, because create_from_ui must return the id of the partner it
          // has created, and reload_partner() must have loaded the newly created partner. 
          self.display_client_details('hide');
        }
      });
    },
    // Shows,hides or edit the customer details box :
    // visibility: 'show', 'hide' or 'edit'
    // partner:    the partner object to show or edit
    // clickpos:   the height of the click on the list (in pixel), used
    //             to maintain consistent scroll.
    display_client_details: function (visibility, partner, clickpos) {
      var self = this;
      var searchbox = this.$('.searchbox input');
      var contents = this.$('.client-details-contents');
      var parent = this.$('.client-list').parent();
      var scroll = parent.scrollTop();
      var height = contents.height();

      contents.off('click', '.button.edit');
      contents.off('click', '.button.save');
      contents.off('click', '.button.undo');
      contents.on('click', '.button.edit', function () {
        self.edit_client_details(partner);
      });
      contents.on('click', '.button.save', function () {
        self.save_client_details(partner);
      });
      contents.on('click', '.button.undo', function () {
        self.undo_client_details(partner);
      });
      this.editing_client = false;
      this.uploaded_picture = null;

      if (visibility === 'show') {
        $('.next').filter('#c_sel').css("visibility", "visible"); //Display set_customer button 
        contents.empty();
        contents.append($(QWeb.render('ClientDetails', {
          widget: this,
          partner: partner
        })));

        var new_height = contents.height();

        if (!this.details_visible) {
          // resize client list to take into account client details
          parent.height('-=' + new_height);

          if (clickpos < scroll + new_height + 20) {
            parent.scrollTop(clickpos - 20);
          } else {
            parent.scrollTop(parent.scrollTop() + new_height);
          }
        } else {
          parent.scrollTop(parent.scrollTop() - height + new_height);
        }

        this.details_visible = true;
        this.toggle_save_button();
      } else if (visibility === 'edit') {
        // Connect the keyboard to the edited field
        if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
          contents.off('click', '.detail');
          searchbox.off('click');
          contents.on('click', '.detail', function (ev) {
            self.chrome.widget.keyboard.connect(ev.target);
            self.chrome.widget.keyboard.show();
          });
          searchbox.on('click', function () {
            self.chrome.widget.keyboard.connect($(this));
          });
        }

        this.editing_client = true;
        contents.empty();
        if (partner.cache) {
          var ids = partner.cache.split(",");
          if ((parseInt(ids[1])) != 0) { //adding current vehicle details to the customer if has
            partner.vehicle_id = parseInt(ids[1]);
          }

        }
        contents.append($(QWeb.render('ClientDetailsEdit', {
          widget: this,
          partner: partner
        })));
        this.toggle_save_button();

        // Browsers attempt to scroll invisible input elements
        // into view (eg. when hidden behind keyboard). They don't
        // seem to take into account that some elements are not
        // scrollable.
        contents.find('input').blur(function () {
          setTimeout(function () {
            self.$('.window').scrollTop(0);
          }, 0);
        });

        contents.find('.image-uploader').on('change', function (event) {
          self.load_image_file(event.target.files[0], function (res) {
            if (res) {
              contents.find('.client-picture img, .client-picture .fa').remove();
              contents.find('.client-picture').append("<img src='" + res + "'>");
              contents.find('.detail.picture').remove();
              self.uploaded_picture = res;
            }
          });
        });
      } else if (visibility === 'hide') {
        $('.next').filter('#c_sel').css("visibility", "hidden"); //hides set_customer button
        contents.empty();
        parent.height('100%');
        if (height > scroll) {
          contents.css({
            height: height + 'px'
          });
          contents.animate({
            height: 0
          }, 400, function () {
            contents.css({
              height: ''
            });
          });
        } else {
          parent.scrollTop(parent.scrollTop() - height);
        }
        this.details_visible = false;
        this.toggle_save_button();
      }
    },
    save_client_details: function (partner) {
      var self = this;
      console.log("Save");
      var fields = {};
      this.$('.client-details-contents .detail').each(function (idx, el) {
        fields[el.name] = el.value || false;
      });

      if (!fields.name) {
        this.gui.show_popup('error', _t('A Customer Name Is Required'));
        return;
      }
      var existing_id = parseInt(fields.name)


      if (this.uploaded_picture) {
        fields.image = this.uploaded_picture;
      }
      fields.exist = false;
      fields.vehicle_id = partner.vehicle_id || false;
      fields.id = partner.id || false;
      fields.country_id = fields.country_id || false;
      if (!isNaN(existing_id)) {
        fields.id = existing_id;
        fields.name = self.pos.db.get_partner_by_id(existing_id).name;
        fields.exist = true;
      }
      if (fields.property_product_pricelist) {
        fields.property_product_pricelist = parseInt(fields.property_product_pricelist, 10);
      } else {
        fields.property_product_pricelist = false;
      }
      //console.log("saved:"+Object.entries(fields));
      rpc.query({
          model: 'res.partner',
          method: 'create_from_ui',
          args: [fields],
        })
        .then(function (partner) {
          self.saved_client_details(partner['partner_id'], partner['vehicle_id']); //getting vehicle_id after creation/updation
        }, function (type, err) {
          var error_body = _t('Your Internet connection is probably down.');
          if (err.data) {
            var except = err.data;
            error_body = except.arguments && except.arguments[0] || except.message || error_body;
          }
          self.gui.show_popup('error', {
            'title': _t('Error: Could not Save Changes'),
            'body': error_body,
          });
        });
    },
  });

  /* ---------- The Action Pad ---------- */

  // The action pad contains the payment button and the 
  // customer selection button
  screens.ActionpadWidget.include({
    init: function (parent, options) {
      var self = this;
      this._super(parent, options);

      this.pos.bind('change:selectedClient', function () {
        //console.log("changed"+selectedClient);
        self.renderElement();
      });
    },
    renderElement: function () {
      var self = this;
      this._super();
      this.$('.pay').click(function () {
        var order = self.pos.get_order();
        var has_valid_product_lot = _.every(order.orderlines.models, function (line) {
          return line.has_valid_product_lot();
        });
        if (!has_valid_product_lot) {
          self.gui.show_popup('confirm', {
            'title': _t('Empty Serial/Lot Number'),
            'body': _t('One or more product(s) required serial/lot number.'),
            confirm: function () {
              self.gui.show_screen('payment');
            },
          });
        } else {
          self.gui.show_screen('payment');
        }
      });
      this.$('.set-customer').click(function () {
        if (sunmi) {
          AndroidInterface.print_check1("none");
        }

        self.gui.show_screen('clientlist');
      });
    },
  });

  screens.NumpadWidget.include({

    start: function () {
      var order = this.pos.get_order();
      this.applyAccessRights();
      this.state.bind('change:mode', this.changedMode, this);
      this.pos.bind('change:cashier', this.applyAccessRights, this);
      this.changedMode();
      this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
      this.$el.find('.numpad-minus').click(_.bind(this.clickSwitchSign, this));
      this.$el.find('.number-char').click(_.bind(this.clickAppendNewChar, this));
      this.$el.find('.mode-button').click(_.bind(this.clickChangeMode, this));
      this.$el.find('.can-sale').click(_.bind(this.clickCanSale, this)); //can_sale actionlistner
    },
    clickSwitchSign: function() {
      var cashier = this.pos.get('cashier') || this.pos.get_cashier();
      if (cashier.role != 'manager') {
        this.gui.show_popup('error', {
          'title': _t('Negative Quantity - Unauthorized function'),
          'body':  _t('Please ask your manager to do it.'),
        });
      }else {
        return this.state.switchSign();
      }
    },
    //toggles cansale button
    clickCanSale: function (event) {
      var order = this.pos.get_order();
      order.set_can_sale(!order.is_can_sale());
      if (order.is_can_sale()) {
        this.$('.can-sale').addClass('cansale');
      } else {
        this.$('.can-sale').removeClass('cansale');
      }

    },
  });

  screens.PaymentScreenWidget.include({
    show: function () {
      $('.back').css({
        "visibility": "visible",
        "opacity": "1"
      });
      this.pos.get_order().clean_empty_paymentlines();
      this.reset_input();
      this.render_paymentlines();
      this.order_changes();
      // that one comes from BarcodeEvents
      $('body').keypress(this.keyboard_handler);
      // that one comes from the pos, but we prefer to cover all the basis
      $('body').keydown(this.keyboard_keydown_handler);
      // legacy vanilla JS listeners
      window.document.body.addEventListener('keypress', this.keyboard_handler);
      window.document.body.addEventListener('keydown', this.keyboard_keydown_handler);
      this._super();
    },
    order_is_valid: function (force_validation) {
      var self = this;
      var order = this.pos.get_order();

      // FIXME: this check is there because the backend is unable to
      // process empty orders. This is not the right place to fix it.
      if (order.get_orderlines().length === 0) {
        this.gui.show_popup('error', {
          'title': _t('Empty Order'),
          'body': _t('There must be at least one product in your order before it can be validated'),
        });
        return false;
      }
      // This checks the order is of can sale
      //error-no-client: the order must have an associated partner_id. You can retry to make an can sale once
      //this error is solved
      if (order.is_can_sale()) {
        //console.log("cansale"+order.get_client());
        this.can_sale = true;
        if (!order.get_client()) {
          self.can_sale = false;
          self.gui.show_popup('confirm', {
            'title': _t('Please select the Customer'),
            'body': _t('You need to select the customer before you validate the Can Sale.'),
            confirm: function () {
              self.gui.show_screen('clientlist');
            },
          });
          return false;
        } else {
          return true;
        }
      }
      if (!order.is_paid() || this.invoicing) {
        return false;
      }

      // The exact amount must be paid if there is no cash payment method defined.
      if (Math.abs(order.get_total_with_tax() - order.get_total_paid()) > 0.00001) {
        var cash = false;
        for (var i = 0; i < this.pos.cashregisters.length; i++) {
          cash = cash || (this.pos.cashregisters[i].journal.type === 'cash');
        }
        if (!cash) {
          this.gui.show_popup('error', {
            title: _t('Cannot return change without a cash payment method'),
            body: _t('There is no cash payment method available in this point of sale to handle the change.\n\n Please pay the exact amount or add a cash payment method in the point of sale configuration'),
          });
          return false;
        }
      }

      // if the change is too large, it's probably an input error, make the user confirm.
      if (!force_validation && order.get_total_with_tax() > 0 && (order.get_total_with_tax() * 1000 < order.get_total_paid())) {
        this.gui.show_popup('confirm', {
          title: _t('Please Confirm Large Amount'),
          body: _t('Are you sure that the customer wants to  pay') +
            ' ' +
            this.format_currency(order.get_total_paid()) +
            ' ' +
            _t('for an order of') +
            ' ' +
            this.format_currency(order.get_total_with_tax()) +
            ' ' +
            _t('? Clicking "Confirm" will validate the payment.'),
          confirm: function () {
            self.validate_order('confirm');
          },
        });
        return false;
      }

      return true;
    },


    validate_order: function (force_validation) {
      if (this.order_is_valid(force_validation)) {
        this.finalize_validation();
        $('.can-sale').removeClass('cansale');
      }
    },
    render_paymentmethods: function() {
        var self = this;
        var methods = $(QWeb.render('PaymentScreen-Paymentmethods', { widget:this }));
        var screensize = document.documentElement.clientWidth;
        if(navigator.userAgent == "my-user-agent" && this.pos.config.is_credit_sale) {
          methods.find('.paymentmethod').css({"width": "30%","display":"inline-block"});
        }
            methods.on('click','.paymentmethod',function(){
                self.click_paymentmethods($(this).data('id'));
            });
        return methods;
    },

  });
  screens.ReceiptScreenWidget.include({
    get_receipt_render_env: function () {
      var order = this.pos.get_order();
      return {
        widget: this,
        pos: this.pos,
        order: order,
        receipt: order.export_for_printing(),
        orderlines: order.get_orderlines(),
        paymentlines: order.get_paymentlines(),
      };
    },
    //Dot matrix printer credit bills
    print_credit_bills: function (toast, pos, db) {
      var receipt = QWeb.render('XmlDotmatrixReceipt', toast);
      var entry_receipt_header = QWeb.render('XmlBillEntry', toast);
      //pos.proxy.print_receipt(receipt, toast.receipt.printer_config); #TESTING
      pos.proxy.print_receipt_entry(entry_receipt_header, toast.receipt.receipt_entry_printer_config);
      if (navigator.userAgent == "my-user-agent") {
        this.switch_pane();
      }
    },
    print_web: function () {
      window.print();
      this.pos.get_order()._printed = true;
    },
    print_xml: function () {
      var receipt = QWeb.render('XmlReceipt', this.get_receipt_render_env());
      var toast = this.get_receipt_render_env();
      //console.log("receipt.printer_config:"+toast.printer_config);
      var format = toast.receipt.printer_config['type'];
      var line = toast.receipt.orderlines;
      //............(Roja 17.8.18)..........
      if (!this.pos.config.printer_type) {
        if (format == "sunmi") {
          
            this.print_sunmi(toast);
          
        }else if (format == "dotmatrix") {
          var receipt = QWeb.render('XmlDotmatrixReceipt', this.get_receipt_render_env());
          //this.pos.proxy.print_receipt(receipt, toast.receipt.printer_config); #TESTING
        } else {
          var receipt = QWeb.render('XmlReceipt', this.get_receipt_render_env());
          this.pos.proxy.print_receipt(receipt, toast.receipt.printer_config);
        }
      }

      //Printing Bill entry in Dotmatrix sales statement 
      if (this.pos.config.is_receipt_entry) {
        var receipt_entry = QWeb.render('XmlBillEntry', this.get_receipt_render_env());
        this.pos.proxy.print_receipt_entry(receipt_entry, toast.receipt.receipt_entry_printer_config);
      }
      this.pos.get_order()._printed = true;
      if (navigator.userAgent == "my-user-agent") {
        this.switch_pane();
      }
    },
    print_sunmi: function (toast) {
      var date = String(toast.receipt.date.date) + "-" + String(toast.receipt.date.month) + "-" + String(toast.receipt.date.year) + " " + moment().format('hh:mm a');
      var dash = Array(35).join("-");
      var dash1 = Array(38).join("-");
      var cmpname = toast.receipt.company.name + ", " + toast.receipt.company.street + " " + toast.receipt.company.street2 + " " + toast.receipt.company.city + "-" + toast.receipt.company.zip + " " + "Ph:" + String(toast.receipt.company.phone);
      var line = toast.receipt.orderlines;
      var tax = toast.receipt.tax_details;

      if (toast.receipt.customer.name) {
        var cus_name = String(toast.receipt.customer.name);
        var vehi = String(((toast.receipt.vehicle_no)));
      } else {
        var cus_name = null;
        var vehi = null;
      }
      if (toast.receipt.customer.vat) {
        if (toast.receipt.customer.vat != 'False') {
          var cus_vat = String(toast.receipt.customer.vat);
        } else {
          var cus_vat = null;
        }
      } else {
        var cus_vat = null;
      }

      //------------------Required receipt details for V1 printer(Roja 30-7-18)--------------------------


      var header_part = [toast.receipt.company.gstin ? String(toast.receipt.company.gstin) : " ", toast.receipt.company.vat ? String(toast.receipt.company.vat) : " ", String(toast.receipt.bill_no), date, dash1];
      var company_details_part = [cmpname, dash1];
      var customer_details_part = [cus_name, vehi, cus_vat, dash1];
      var product_details_part = [dash];
      var tax_details_part = [];
      var tot_price = (toast.receipt.total_with_tax).toFixed(this.pos.currency.decimals);
      var total_part = [dash, String(tot_price)];
      //pushing products details 

      for (var i = 0; i < line.length; i++) {
        if (line[i].l10n_in_hsn_code) {
          var l1 = String(line[i].product_name + "[" + line[i].l10n_in_hsn_code + "]");
        } else {
          var l1 = String(line[i].product_name);
        }
        if (line[i].remove_trailing_zeros) {
          var product_qty = (line[i].quantity).toFixed(this.pos.dp["Product Unit of Measure"]) * 1;
        } else {
          var product_qty = (line[i].quantity).toFixed(this.pos.dp["Product Unit of Measure"]);
        }
        var qt = String(product_qty + " " + line[i].unit_name + "X" + line[i].price.toFixed(this.pos.dp["Product Price"]));
        var price = (line[i].price_display).toFixed(this.pos.currency.decimals);
        var emp = Array(33 - (qt.length + String(price).length)).join(" ");
        var l2 = "  " + qt + emp + price;
        product_details_part.push(l1);
        product_details_part.push(l2);
      }


      //pushing tax details

      for (var i = 0; i < tax.length; i++) {
        var price = (tax[i].amount).toFixed(this.pos.currency.decimals);
        var emp = Array(35 - (String(tax[i].name).length + String(price).length)).join(" ");
        var t1 = String(tax[i].name) + emp + String(price);
        tax_details_part.push(t1);
      }


      //-----------------Sending the invoice details to the app---------------------------

      //AndroidInterface.showToast(String(toast.receipt.company.gstin),String(toast.receipt.company.vat));

      AndroidInterface.print_header(header_part);
      AndroidInterface.print_company_details(company_details_part);
      AndroidInterface.print_customer_details(customer_details_part);
      AndroidInterface.print_product_details(product_details_part);
      AndroidInterface.print_tax_details(tax_details_part);
      AndroidInterface.print_total(total_part);
      this.switch_pane();
    },
    switch_pane: function() {
      var self = this;
      $('.pos-switchbuttons').find('.count').text('0');
      $('.product-screen').find('.leftpane').css({
        "visibility": "hidden",
        "opacity": "0"
      });
      $('.product-screen').find('.rightpane').css({
        "visibility": "visible",
        "opacity": "1"
      });
      $('.pos-switchbuttons').find('.switchorder').css({
        "border-top": "0.1em solid #6ec89b"
      });
      $('.pos-switchbuttons').find('.switchpay').css({
        "border-top": "0.1em solid #d3d3d3"
      });
      
    },

    print: function () {
      var self = this;

      if (!this.pos.config.iface_print_via_proxy) { // browser (html) printing

        // The problem is that in chrome the print() is asynchronous and doesn't
        // execute until all rpc are finished. So it conflicts with the rpc used
        // to send the orders to the backend, and the user is able to go to the next 
        // screen before the printing dialog is opened. The problem is that what's 
        // printed is whatever is in the page when the dialog is opened and not when it's called,
        // and so you end up printing the product list instead of the receipt... 
        //
        // Fixing this would need a re-architecturing
        // of the code to postpone sending of orders after printing.
        //
        // But since the print dialog also blocks the other asynchronous calls, the
        // button enabling in the setTimeout() is blocked until the printing dialog is 
        // closed. But the timeout has to be big enough or else it doesn't work
        // 1 seconds is the same as the default timeout for sending orders and so the dialog
        // should have appeared before the timeout... so yeah that's not ultra reliable. 

        this.lock_screen(true);

        setTimeout(function () {
          self.lock_screen(false);
        }, 1000);

        this.print_web();
      } else { // proxy (xml) printing
        this.print_xml();
        this.lock_screen(false);
      }
    },
  });

  screens.ProductCategoriesWidget.include({

    render_category: function (category, with_image) {
      var cached = this.category_cache.get_node(category.id);
      if (!cached) {
        if (with_image) {
          var image_url = this.get_image_url(category);
          var category_html = QWeb.render('CategoryButton', {
            widget: this,
            category: category,
            image_url: this.get_image_url(category),
          });
          category_html = _.str.trim(category_html);
          var category_node = document.createElement('div');
          category_node.innerHTML = category_html;
          category_node = category_node.childNodes[0];
        } else {
          //made category name having unique length
          var string = category.name;
          var length = 20;
          var trimmedString = string.length > length ?
            string.substring(0, length - 3) + "..." :
            string + Array((20 - string.length) + 1).join(" ");
          category.name = trimmedString;
          //console.log("trimm:"+category.name.length);
          var category_html = QWeb.render('CategorySimpleButton', {
            widget: this,
            category: category,
          });
          category_html = _.str.trim(category_html);
          var category_node = document.createElement('div');
          category_node.innerHTML = category_html;
          category_node = category_node.childNodes[0];
        }
        this.category_cache.cache_node(category.id, category_node);
        return category_node;
      }
      return cached;
    },


    renderElement: function () {

      var el_str = QWeb.render(this.template, {
        widget: this
      });
      var el_node = document.createElement('div');

      el_node.innerHTML = el_str;
      el_node = el_node.childNodes[1];

      if (this.el && this.el.parentNode) {
        this.el.parentNode.replaceChild(el_node, this.el);
      }

      this.el = el_node;

      var withpics = this.pos.config.iface_display_categ_images;

      var list_container = el_node.querySelector('.category-list');
      if (list_container) {
        if (!withpics) {
          list_container.classList.add('simple');
        } else {
          list_container.classList.remove('simple');
        }
        for (var i = 0, len = this.subcategories.length; i < len; i++) {
          list_container.appendChild(this.render_category(this.subcategories[i], withpics));
        }
      }

      var buttons = el_node.querySelectorAll('.js-category-switch');

      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', this.switch_category_handler);
      }

      var products = this.pos.db.get_product_by_category(this.category.id);
      if (this.category.id == 0) {
        //console.log("zero:"+products.length);
        products.sort(function (a, b) {
          if (a.fav == null) {
            a.fav = 0;
          }
          if (b.fav == null) {
            b.fav = 0;
          }
          return b.fav - a.fav;
        });
      } else {
        products.sort(function (a, b) {
          return a.lst_price - b.lst_price;
        });
      }

      this.product_list_widget.set_product_list(products); // FIXME: this should be moved elsewhere ... 
      var cnt = $(".orderlines > li").size();
      $('.pos-switchbuttons').find('.count').text(cnt);
      /*if ((cnt > 0) && (navigator.userAgent == "my-user-agent")) {
        $('.product-screen').find('.leftpane').css({
          "visibility": "visible",
          "opacity": "1"
        });
        $('.product-screen').find('.rightpane').css({
          "visibility": "hidden",
          "opacity": "0"
        });
        $('.pos-switchbuttons').find('.switchorder').css({
          "border-top": "0.1em solid #d3d3d3"
        });
        $('.pos-switchbuttons').find('.switchpay').css({
          "border-top": "0.1em solid #6ec89b"
        });
      }*/
      this.el.querySelector('.searchbox input').addEventListener('keypress', this.search_handler);

      this.el.querySelector('.searchbox input').addEventListener('keydown', this.search_handler);

      this.el.querySelector('.search-clear').addEventListener('click', this.clear_search_handler);

      if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
        this.chrome.widget.keyboard.connect($(this.el.querySelector('.searchbox input')));
      }
    },
  });


  db.include({
    init: function (options) {
      this._super.apply(this, arguments);
      var self = this;
      this.vehicles = {};
      this.pump_sale_products = {};
      this.classfication = [];
      this.product_classfication = {};
      this.search_string = "";
      this.vehicle_search_String = "";
      this.printers = {};
      this.receipt_printer = [];
    },
    //Return Printer classification
    get_printer_config_by_id: function (id) {
      return this.printers[id];
    },


    //Return product classification
    get_product_classification: function () {
      return this.classfication;
    },
    //get vehicle number by id
    get_vehicle_number: function (vid) {
      return this.vehicles[vid];
    },
    //generate search string inculdes vehicle numbers
    generate_search_string: function () {
      for (var j = 0; j < this.partner_sorted.length; j++) {
        var vehi = this.partner_by_id[this.partner_sorted[j]].vehicle_no;
        if (vehi) {
          for (var k = 0; k < vehi.length; k++) {
            this.search_string += this._partner_search_string(this.partner_by_id[this.partner_sorted[j]], vehi[k]);
          }
        }
        if (vehi == "") {
          this.search_string += this._partner_search_string(this.partner_by_id[this.partner_sorted[j]]);
        }
      }

    },
    search_partner: function (query) {
      try {
        query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
        query = query.replace(/ /g, '.+');
        query = query.replace(/\s/g, '');
        var re = RegExp("([0-9]+):.*?" + query, "gi");
        // console.log("re:"+re);
      } catch (e) {
        return [];
      }
      var results = [];
      for (var i = 0; i < this.limit; i++) {
        var r = re.exec(this.search_string); //uses search string inculding vehicle numbers

        if (r) {
          var id = Number(r[1]);
          results.push(this.get_partner_by_id(id));
        } else {
          break;
        }
      }
      return results;
    },
    _partner_search_string: function (partner, vehicle_id) {
      vehicle_id = vehicle_id || false;
      var searchId = partner.id;
      var str = partner.name;
      if (partner.barcode) {
        str += '|' + partner.barcode;
      }
      if (partner.address) {
        str += '|' + partner.address;
      }
      if (partner.phone) {
        str += '|' + partner.phone.split(' ').join('');
      }
      if (partner.mobile) {
        str += '|' + partner.mobile.split(' ').join('');
      }
      if (partner.email) {
        str += '|' + partner.email;
      }
      if (vehicle_id) { //adds vehicle number to the search string
        var vehicle = this.get_vehicle_number(vehicle_id);
        if (vehicle) {
          searchId += vehicle.id;
          str += '|' + vehicle.vehicle_number.replace(/ /g, '', '.');
        }
      }
      str = '' + partner.id + ':' + str.replace(':', '') + '\n';
      return str;
    },
    add_partners: function (partners) {
      var updated_count = 0;
      var new_write_date = '';
      var partner;
      for (var i = 0, len = partners.length; i < len; i++) {
        partner = partners[i];

        var local_partner_date = (this.partner_write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
        var dist_partner_date = (partner.write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
        if (this.partner_write_date &&
          this.partner_by_id[partner.id] &&
          new Date(local_partner_date).getTime() + 1000 >=
          new Date(dist_partner_date).getTime()) {
          // FIXME: The write_date is stored with milisec precision in the database
          // but the dates we get back are only precise to the second. This means when
          // you read partners modified strictly after time X, you get back partners that were
          // modified X - 1 sec ago. 
          continue;
        } else if (new_write_date < partner.write_date) {
          new_write_date = partner.write_date;
        }
        if (!this.partner_by_id[partner.id]) {
          //console.log("push");
          this.partner_sorted.push(partner.id);

        }
        this.partner_by_id[partner.id] = partner;

        updated_count += 1;
      }

      this.partner_write_date = new_write_date || this.partner_write_date;

      if (updated_count) {
        // If there were updates, we need to completely 
        // rebuild the search string and the barcode indexing

        this.partner_search_string = "";
        this.partner_by_barcode = {};

        for (var id in this.partner_by_id) {
          partner = this.partner_by_id[id];

          if (partner.barcode) {
            this.partner_by_barcode[partner.barcode] = partner;
          }
          partner.address = (partner.street || '') + ', ' +
            (partner.zip || '') + ' ' +
            (partner.city || '') + ', ' +
            (partner.country_id[1] || '');
          this.partner_search_string += this._partner_search_string(partner);
        }
        // console.log("partner_sear:"+this.partner_search_string);
      }
      return updated_count;
    },

  });
});
