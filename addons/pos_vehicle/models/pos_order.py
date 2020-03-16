# -*- coding: utf-8 -*-
###################################################################################
#
#    Shorepointsystem Private Limited
#    Author: Roja (27-9-18)
#
#
###################################################################################

import logging

from datetime import timedelta
from functools import partial

import psycopg2
import pytz

from odoo import models, fields, api, tools
from odoo.tools import float_is_zero
from odoo import exceptions, _
from odoo import http
from datetime import datetime
from collections import Counter
_logger = logging.getLogger(__name__)



#----Adding of vehicle,can sales details in pos_order creation ----------------------

class InheritPosOrders(models.Model):
    _inherit='pos.order'
    vehicle_id = fields.Many2one('pos.vehicle', string='Vehicle')
    is_can_sale = fields.Boolean(string="Is Can Sale")
    
    @api.model
    def _order_fields(self, ui_order):
        process_line = partial(self.env['pos.order.line']._order_line_fields, session_id=ui_order['pos_session_id'])
        return {
            'name':         ui_order['name'],
            'user_id':      ui_order['user_id'] or False,
            'session_id':   ui_order['pos_session_id'],
            'lines':        [process_line(l) for l in ui_order['lines']] if ui_order['lines'] else False,
            'pos_reference': ui_order['name'],
            'partner_id':   ui_order['partner_id'] or False,
            'vehicle_id':   ui_order['partner_vehicle_id'] or False, # adding vehicle_id field in pos_order
            'date_order':   ui_order['creation_date'],
            'fiscal_position_id': ui_order['fiscal_position_id'],
            'pricelist_id': ui_order['pricelist_id'],
            'is_can_sale' : ui_order['is_can_sale'], # adding is_can_sale field in pos_order
            #'device_sequence' : ui_order['device_sequence'],
        }
    @api.model
    def _process_order(self, pos_order):
        prec_acc = self.env['decimal.precision'].precision_get('Account')
        pos_session = self.env['pos.session'].browse(pos_order['pos_session_id'])
        pos_config = self.env['pos.session'].browse(pos_order['pos_session_id']).config_id
        if pos_session.state == 'closing_control' or pos_session.state == 'closed':
            pos_order['pos_session_id'] = self._get_valid_session(pos_order).id
        order = self.create(self._order_fields(pos_order))
        journal_ids = set()
        for payments in pos_order['statement_ids']:
            if not float_is_zero(payments[2]['amount'], precision_digits=prec_acc):
                order.add_payment(self._payment_fields(payments[2]))
            journal_ids.add(payments[2]['journal_id'])

        if pos_session.sequence_number <= pos_order['sequence_number']:
            pos_session.write({'sequence_number': pos_order['sequence_number'] + 1})
            pos_session.refresh()
        #if pos_order['bill_sequence'] <= pos_order['bill_sequence']:
            #pos_config.write({'bill_sequence': pos_order['bill_sequence'] + 1})
           # pos_config.refresh()

        if not float_is_zero(pos_order['amount_return'], prec_acc):
            cash_journal_id = pos_session.cash_journal_id.id
            if not cash_journal_id:
                # Select for change one of the cash journals used in this
                # payment
                cash_journal = self.env['account.journal'].search([
                    ('type', '=', 'cash'),
                    ('id', 'in', list(journal_ids)),
                ], limit=1)
                if not cash_journal:
                    # If none, select for change one of the cash journals of the POS
                    # This is used for example when a customer pays by credit card
                    # an amount higher than total amount of the order and gets cash back
                    cash_journal = [statement.journal_id for statement in pos_session.statement_ids if statement.journal_id.type == 'cash']
                    if not cash_journal:
                        raise UserError(_("No cash statement found for this session. Unable to record returned cash."))
                cash_journal_id = cash_journal[0].id
            order.add_payment({
                'amount': -pos_order['amount_return'],
                'payment_date': fields.Datetime.now(),
                'payment_name': _('return'),
                'journal': cash_journal_id,
            })
        return order

class InheritPosConfig(models.Model):
      _inherit="pos.config"
      bill_sequence= fields.Integer(string="Bill sequence",default=0)
 

#sales details report customization

class ReportSaleDetailsInherit(models.AbstractModel):

    _inherit = 'report.point_of_sale.report_saledetails'


    @api.model
    def get_sale_details(self, date_start=False, date_stop=False, configs=False):
        """ Serialise the orders of the day information

        params: date_start, date_stop string representing the datetime of order
        """
        if not configs:
            configs = self.env['pos.config'].search([])

        user_tz = pytz.timezone(self.env.context.get('tz') or self.env.user.tz or 'UTC')
        today = user_tz.localize(fields.Datetime.from_string(fields.Date.context_today(self)))

        today = today.astimezone(pytz.timezone('UTC'))

        if date_start:
            date_start = fields.Datetime.from_string(date_start)
        else:
            # start by default today 00:00:00
            date_start = today

        if date_stop:
            # set time to 23:59:59
            date_stop = fields.Datetime.from_string(date_stop)
        else:
            # stop by default today 23:59:59
            date_stop = today + timedelta(days=1, seconds=-1)

        # avoid a date_stop smaller than date_start
        date_stop = max(date_stop, date_start)

        date_start = fields.Datetime.to_string(date_start)
        date_stop = fields.Datetime.to_string(date_stop)
        
        orders = self.env['pos.order'].search([
            ('date_order', '>=', date_start),
            ('date_order', '<=', date_stop),
            ('state', 'in', ['paid','invoiced','done']),
            ('config_id', 'in', configs.ids)])

        so=self.env['sale.order'].search([
            ('date_order', '>=', date_start),
            ('date_order', '<=', date_stop),
            ('invoice_status', '=', 'invoiced'),
            ('from_pos', '=', True)])
 
        user_currency = self.env.user.company_id.currency_id
        date=datetime.strptime(date_start, '%Y-%m-%d %H:%M:%S')+ timedelta(hours=5,minutes=30)
        s_date=date.strftime("%d-%m-%Y %I:%M %p ")
        date1=datetime.strptime(date_stop, '%Y-%m-%d %H:%M:%S')+ timedelta(hours=5,minutes=30)
        e_date=date1.strftime("%d-%m-%Y %I:%M %p ")
        _logger.info("INFO: Sales Report from %s to %s" %(s_date,e_date))
        total = 0.0
        total_so=0.0
        products_sold = {}
        products_sold1 = {}
        products_sold_so={}
        products_sold_so1={}
        taxes = {}
        taxes_so ={}
        bill_no=[]
        bill_nos=[]
        credit_bill_no=[]
        sessionids=[]
        order_total=0.0
        amt =0.0
#...................Fetching the bill numbers(Roja 17.8.18)..................
        self.env.cr.execute(""" SELECT DISTINCT session_id AS id FROM pos_order WHERE date_order > '%s' AND date_order < '%s' """ %(date_start,date_stop))
        sessions = self.env.cr.dictfetchall()
        for session in sessions:
            sessionids.append(session['id'])
        if sessionids:
           if(len(sessionids)==1):
               session_id_tup='(%s)' %sessionids[0]
           else:
               session_id_tup=tuple(sessionids)
        
           for config_id in configs.ids:
               self.env.cr.execute(""" (SELECT DISTINCT id,name FROM pos_order WHERE (SELECT config_id from pos_session WHERE id=session_id)='%s' AND session_id IN %s AND date_order > '%s' AND date_order < '%s' ORDER BY id ASC LIMIT 1) UNION ALL (SELECT DISTINCT id,name FROM pos_order WHERE (SELECT config_id from pos_session WHERE id=session_id)='%s' AND session_id IN %s AND date_order > '%s' AND date_order < '%s' ORDER BY id DESC LIMIT 1)  """ %(config_id,session_id_tup,date_start,date_stop,config_id,session_id_tup,date_start,date_stop))
               bill=self.env.cr.dictfetchall()
               if bill:
                  bill_nos.append({'start_bill_no':bill[0]['name'],'end_bill_no':bill[1]['name']})

        for order in orders:
            bill_no.append(order.name)
            if user_currency != order.pricelist_id.currency_id:
                total += order.pricelist_id.currency_id.compute(order.amount_total, user_currency)
                amt += order.pricelist_id.currency_id.compute(order.amount_total, user_currency)
            else:
                total += order.amount_total
                amt += order.amount_total
            currency = order.session_id.currency_id
            #credit_bill_no.append({'id':order.partner_id,'bill_no':order.pos_bill_no})
            for line in order.lines:
                key = (line.product_id, line.price_unit, line.discount)
                products_sold.setdefault(key, 0.0)
                products_sold[key] += line.qty
                key1 = (line.product_id, line.price_unit, line.discount,line.product_id.remove_trailing_zeros)
                products_sold1.setdefault(key1, [0.0,0.0,0.0])
                products_sold1[key1][0] += line.qty
                products_sold1[key1][1] += 0.0
                products_sold1[key1][2] += line.price_subtotal
                if line.tax_ids_after_fiscal_position:
                    line_taxes = line.tax_ids_after_fiscal_position.compute_all(line.price_unit * (1-(line.discount or 0.0)/100.0), currency, line.qty, product=line.product_id, partner=line.order_id.partner_id or False)
                    for tax in line_taxes['taxes']:
                        taxes.setdefault(tax['id'], {'name': tax['name'], 'tax_amount':0.0, 'base_amount':0.0})
                        taxes[tax['id']]['tax_amount'] += tax['amount']
                        taxes[tax['id']]['base_amount'] += tax['base']
                else:
                    taxes.setdefault(0, {'name': _('No Taxes'), 'tax_amount':0.0, 'base_amount':0.0})
                    taxes[0]['base_amount'] += line.price_subtotal_incl

        

#...................Fetching the sales orders(Roja 14.8.18)..................
        for sorder in so:
            #credit_bill_no.append(sorder.name)
            for invoice in sorder.invoice_ids:
                credit_bill_no.append(invoice.number)
            if user_currency != sorder.pricelist_id.currency_id:
                total_so += sorder.pricelist_id.currency_id.compute(sorder.amount_total, user_currency)
                amt += sorder.pricelist_id.currency_id.compute(sorder.amount_total, user_currency)
            else:
                total_so += sorder.amount_total
                amt += sorder.amount_total
            currency = sorder.pricelist_id.currency_id

            for line in sorder.order_line:
                key = (line.product_id, line.price_unit, line.discount)
                key1= (line.product_id, line.price_unit, line.discount,line.product_id.remove_trailing_zeros)
                products_sold_so.setdefault(key, 0.0)
                products_sold_so[key] += line.product_uom_qty
                products_sold_so1.setdefault(key1, [0.0,0.0,0.0])
                products_sold_so1[key1][0] += line.product_uom_qty
                products_sold_so1[key1][1] += 0.0
                products_sold_so1[key1][2] += line.price_subtotal
                if line.tax_id:
                    line_taxes = line.tax_id.compute_all(line.price_unit * (1-(line.discount or 0.0)/100.0), currency, line.product_uom_qty, product=line.product_id, partner=line.order_id.partner_id or False)
                    for tax in line_taxes['taxes']:
                        taxes_so.setdefault(tax['id'], {'name': tax['name'], 'tax_amount':0.0, 'base_amount':0.0})
                        taxes_so[tax['id']]['tax_amount'] += tax['amount']
                        taxes_so[tax['id']]['base_amount'] += tax['base']
                else:
                    taxes_so.setdefault(0, {'name': _('No Taxes'), 'tax_amount':0.0, 'base_amount':0.0})
                    taxes_so[0]['base_amount'] += line.price_reduce_taxinc

        #products_sold = Counter(products_sold) + Counter(products_sold_so)
        for k, v in products_sold_so1.items():
            if k in products_sold1.keys():
               products_sold1[k] += v
            else:
               products_sold1[k] = v
        tax_list=list(taxes.values())
        tax_so_list=list(taxes_so.values())
        combine=tax_list+tax_so_list
        combine_list=[]
        join=False
        for line in combine:
            if combine_list:
               for x in combine_list:
                   if  x['name'] == line['name'] :
                       join=False
                       x['tax_amount'] = x['tax_amount']+line['tax_amount']
                       x['tax_amount'] = "%0.2f" %float(x['tax_amount']) if x['tax_amount'] else 0.0
                       x['base_amount']=x['base_amount']+line['base_amount']
                       break
                   else:
                       join=True
            else:
               combine_list.append(line)
            if join:
               combine_list.append(line)
        taxes=combine_list
        for i in taxes:
            i['tax_amount']='%0.2f' %float(i['tax_amount'])
        total=total+total_so

       #finding deleted orders..........

        del_orders = self.env['pos.orders.deleted'].search([
	('date_order', '>=', date_start),
	('date_order', '<=', date_stop)])
        deleted_orders_pdf=[]
        for del_order in del_orders:
            del_taxes = {}
            product=""
            amount=0.0
            qty=""
            tax_amt=0.0
            price=""
            bill_no=del_order.del_name
            for del_line in del_order.deleted_id:
                product += del_line.product_id.product_tmpl_id.name+" , "
                amount += del_line.qty*del_line.price_unit
                qty += str("%.2f" %del_line.qty)+del_line.product_id.product_tmpl_id.uom_id.name+" , "  
                price += str("%.3f" %del_line.price_unit)+" , " 
                if del_line.del_tax_ids:
                    line_taxes = del_line.del_tax_ids.compute_all(del_line.price_unit * (1-(del_line.discount or 0.0)/100.0), currency, del_line.qty, product=del_line.product_id, partner=del_line.deleted_order.partner_id or False)
                    for tax in line_taxes['taxes']:
                        del_taxes.setdefault(tax['id'], {'name': tax['name'], 'tax_amount':0.0, 'base_amount':0.0})
                        del_taxes[tax['id']]['tax_amount'] += tax['amount']
                        del_taxes[tax['id']]['base_amount'] += tax['base']
                        amount +=tax['amount']
            product = product.rstrip(' , ')
            qty = qty.rstrip(' , ')
            price = price.rstrip(' , ')
            tax_deleted=list(del_taxes.values())
            for i in tax_deleted:
                tax_amt=i['tax_amount']
            deleted_orders_pdf.append({'bill_no':bill_no,'items':product,'qty':qty,'price':price,'cgst':tax_amt,'sgst':tax_amt,'amt':amount})
          

        #bill=("%s TO %s" %(bill_no[-1],bill_no[0]))
        #_logger.info("deleted report %s" %(del_orders.pos_reference))
        if bill_no:
           f_bill_no=bill_no[-1]
           l_bill_no=bill_no[0]
           #index=bill_no[-1].rfind('-')
           #if index != -1 :
              #f_bill_no=bill_no[-1][index+1:]
           #index1=bill_no[0].rfind('-')
           #if index1 != -1 :
            #  l_bill_no=bill_no[0][index1+1:]
        else:
            f_bill_no=0
            l_bill_no=0
        if credit_bill_no:
           cf_bill_no=credit_bill_no[-1]
           cl_bill_no=credit_bill_no[0]
        else:
            cf_bill_no=0
            cl_bill_no=0
        #_logger.info("b_no report %s" %(bill))
        st_line_ids = self.env["account.bank.statement.line"].search([('pos_statement_id', 'in', orders.ids)]).ids
        if st_line_ids:
            self.env.cr.execute("""
                SELECT aj.name, sum(amount) total
                FROM account_bank_statement_line AS absl,
                     account_bank_statement AS abs,
                     account_journal AS aj 
                WHERE absl.statement_id = abs.id
                    AND abs.journal_id = aj.id 
                    AND absl.id IN %s 
                GROUP BY aj.name
            """, (tuple(st_line_ids),))
            payments = self.env.cr.dictfetchall()
        else:
            payments = []
        if so:
            payments.append({'name':'Credit' ,'total':"%0.2f" %float(total_so) if total_so else 0.0})
            self.env.cr.execute(""" SELECT SUM(amount_total) ,(SELECT name FROM res_partner WHERE id= partner_id) FROM sale_order WHERE date_order > '%s' AND date_order < '%s' AND invoice_status = 'invoiced' AND from_pos='True' GROUP BY partner_id """ %(date_start,date_stop))
            credit_parties = self.env.cr.dictfetchall()
            #for name in credit_parties:
        #_logger.info("payments %s " % credit_parties)
        else:
            credit_parties = []
        #header = self.env['ir.actions.report'].render_template("web.internal_layout", values=s_date)

        product_with_total=sorted([{
                'product_id': product.id,
                'product_name': product.name,
                'code': product.default_code,
                'quantity': val[0],
                'tax':val[1],
                'tot':val[2],
                'total_qty':round(val[0]+(val[3] if len(val)>3 else 0.0)) if remove else "%0.4f" %float(val[0]+(val[3] if len(val)>3 else 0.0)),
                'total_amt':"%0.2f" %float(val[2]+(val[5] if len(val)>3 else 0.0)),
                'so_quantity': val[3] if len(val)>3 else 0.0,
                'so_tax':val[4] if len(val)>3 else 0.0,
                'so_tot':val[5] if len(val)>3 else 0.0,
                'price_unit': price_unit,
                'discount': discount,
                'uom': product.uom_id.name
            } for (product, price_unit, discount,remove), val in products_sold1.items()], key=lambda l: l['product_name'])
        pro=sorted([{
                'product_id': product.id,
                'product_name': product.name,
                'code': product.default_code,
                'quantity': qty,
                'price_unit': price_unit,
                'discount': discount,
                'uom': product.uom_id.name
            } for (product, price_unit, discount), qty in products_sold.items()], key=lambda l: l['product_name'])

        return {
            'currency_precision': user_currency.decimal_places,
            'total_paid': user_currency.round(total),
            'payments': payments,
            'del_bills' : deleted_orders_pdf,
            'credit_parties' : credit_parties,
            's_date':s_date,
            'e_date':e_date,
            's_bill_no': f_bill_no,
            'e_bill_no' : l_bill_no,
            'cs_bill_no': cf_bill_no,
            'ce_bill_no' : cl_bill_no,
            'bill_nos': bill_nos,
            'company_name': self.env.user.company_id.name,
            'taxes': taxes,
            'products': product_with_total,
            'amt' : "%0.2f" %float(amt) if amt else 0.0,
        }

    @api.multi
    def get_report_values(self, docids, data=None):
        data = dict(data or {})
        configs = self.env['pos.config'].browse(data['config_ids'])
        data.update(self.get_sale_details(data['date_start'], data['date_stop'], configs))
        return data






