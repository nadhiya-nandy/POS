# -*- coding: utf-8 -*-
###################################################################################
#
#    Shorepointsystem Private Limited
#    Author: Roja (25-9-18)
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

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = 'res.partner'
    
    name=fields.Char(translate=True)
    vehicle_no = fields.One2many('pos.vehicle','customer_name',string="Vehicle Number",required="True")
    country_id=fields.Many2one('res.country', 'Partner Country',default=104)
    #alias_name= fields.Char(string='Alias Name')

    #----Adding of vehicle_details when Customer is created/edited from POS ----------------------

    @api.model
    def create_from_ui(self, partner):
        """ create or modify a partner from the point of sale ui.
            partner contains the partner's fields. """
        # image is a dataurl, get the data after the comma
        if partner.get('image'):
            partner['image'] = partner['image'].split(',')[1]
        partner_id = partner.pop('id', False)
        vehicle_id = partner.pop('vehicle_id', False)
        veh=partner.pop('vehicle_no', False)
        if veh:
           vehicle_number=veh.upper()
        else:
           vehicle_number=veh
        partner_exist=partner.pop('exist', False)
        pos_vehicle=self.env['pos.vehicle']
        if partner_exist and not vehicle_id:
           partner['vehicle_no']= [(0, 0, {'vehicle_number':  vehicle_number})]
           self.browse(partner_id).write(partner)
           vehicle_id=pos_vehicle.search([('vehicle_number','=',vehicle_number)]).id
        else:
          if partner_id:  # Modifying existing partner
            if vehicle_id:# Modifying existing vehicle 
                  old=pos_vehicle.browse(vehicle_id).vehicle_number
                  if old != vehicle_number:
                     pos_vehicle.browse(vehicle_id).write({'vehicle_number':vehicle_number})               
            else:
               if vehicle_number:# creating new vehicle for existing partner
                  _logger.info("no vehicle_id:")
                  partner['vehicle_no']= [(0, 0, {'vehicle_number':  vehicle_number})]
            self.browse(partner_id).write(partner)
            if not vehicle_id:
               vehicle=self.browse(partner_id).vehicle_no.ids
               if len (vehicle)>1:
                  vehicle_id=pos_vehicle.search([('vehicle_number','=',vehicle_number)]).id 
               else:
                  vehicle_id=vehicle
            _logger.info("no vehicle_id m:%s" %vehicle_id)
          else:
            partner['lang'] = self.env.user.lang
            _logger.info("partner:%s" %partner) 
            if vehicle_number:# creating vehicle details for new customer
               partner['vehicle_no']= [(0, 0, {'vehicle_number':  vehicle_number})]
            partner_id = self.create(partner).id      
            vehicle_id=pos_vehicle.search([('vehicle_number','=',vehicle_number)]).id  
        return {'partner_id':partner_id,'vehicle_id':vehicle_id}

