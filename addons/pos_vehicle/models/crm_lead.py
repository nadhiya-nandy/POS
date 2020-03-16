# -*- coding: utf-8 -*-
###################################################################################
#
#    Shorepointsystem Private Limited
#    Author: Roja (29-9-18)
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

class InheritLead(models.Model):
    _inherit = "crm.lead"
    vehicle_id = fields.Many2one('pos.vehicle', string='Vehicle')
    @api.onchange('vehicle_id')
    def onchange_vehicle(self):
        if self.vehicle_id:
           self.partner_id=self.env['pos.vehicle'].browse(self.vehicle_id.id).customer_name
    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        values = self._onchange_partner_id_values(self.partner_id.id if self.partner_id else False)
        self.update(values)
        res = {}
        if self.partner_id:
           res['domain'] = {'vehicle_id': [('customer_name', '=', self.partner_id.id)]}
        return res
           




    
