# -*- coding: utf-8 -*-
import logging

from datetime import timedelta
from functools import partial

import psycopg2
import pytz


from odoo import models, fields, api
from odoo import exceptions, _
from odoo import http
from datetime import datetime

_logger = logging.getLogger(__name__)


class Network(models.Model):
    _inherit = "pos.config"
    is_receipt_entry= fields.Boolean("Receipt Entry",default=False)
    printer=fields.Many2one('pos.printers',string='Printer')
    printer_format = fields.Selection([('epson_t20','Epson T20'),('dotmatrix','DotMatrix-FX-890')], string="Printer Format" , default="dotmatrix", required=True)

