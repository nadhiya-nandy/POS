# -*- coding: utf-8 -*-
###################################################################################
#
#    Shorepointsystem Private Limited
#    Author: Roja (20-9-18)
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

#Vehicle details
class Vehiclenum(models.Model):
    _name='pos.vehicle'
    _rec_name='vehicle_number'  
    vehicle_number=fields.Char(String='Vehicle Number',required='TRUE')
    customer_name=fields.Many2one('res.partner',ondelete='cascade',string='Customer name')
    model_id = fields.Many2one('vehicle.model', 'Model',  help='Model of the vehicle')
    variant_id = fields.Many2one('vehicle.variant', 'Variant',  help='Model Variant')
    #category_id = fields.Many2one('vehicle.category', 'Category',  help='Vehicle category')
    #bodytype_id = fields.Many2one('vehicle.bodytype', 'Body Type',  help='Vehicle Body Type')
    #fuel_type = fields.Selection([('petrol','Petrol'),('diesel','Diesel'),('cng','CNG'),('lpg','LPG')],'Fuel Type')
    #model_year = fields.Char('Model Year',help='Year of the model')
    #axles_no=fields.Char('Number of Axles',help='Number of Axles')
    owner_details=fields.One2many('res.partner','name',string="Vehicle Ex Owners")
    owners_details=fields.Many2many('res.partner','name',string="Vehicle Ex Owners")
    owner_change_ids=fields.One2many('ownership', 'vehicle', string='Ownership History')
    image = fields.Binary("Image", attachment=True,
        help="This field holds the image used as avatar for this contact, limited to 1024x1024px",)
    image_medium = fields.Binary("Medium-sized image", attachment=True,
        help="Medium-sized image of this contact. It is automatically "\
             "resized as a 128x128px image, with aspect ratio preserved. "\
             "Use this field in form views or some kanban views.")
    image_small = fields.Binary("Small-sized image", attachment=True,
        help="Small-sized image of this contact. It is automatically "\
             "resized as a 64x64px image, with aspect ratio preserved. "\
             "Use this field anywhere a small image is required.")
    _sql_constraints = [ ('vehicle_number_unique','UNIQUE (vehicle_number)','Vehicle Number already exists'), ]



    @api.onchange('model_id')
    def onchange_model(self):
        res = {}
        if self.model_id:
           res['domain'] = {'variant_id': [('vehicle_model_id', '=', self.model_id.id)]}
        return res

    @api.onchange('category_id')
    def onchange_category(self):
        res = {}
        if self.category_id:
           res['domain'] = {'bodytype_id': [('category_id', '=', self.category_id.id)]}
        return res


    @api.model
    def create(self, vals):
        tools.image_resize_images(vals)
        vehicle = super(Vehiclenum, self).create(vals)
        vehicle.create_owners()
        return vehicle

    @api.multi
    def write(self, vals):
        _logger.info("write %s,id:%s" % (vals,self.id))
        tools.image_resize_images(vals)
        owner_write=self.env['ownership']
        if 'customer_name' in vals:
           update_owner=owner_write.search([('vehicle','=',self.id),('exp_date','=',False)])
           update_owner.write({'exp_date':datetime.today()})
           _logger.info("write enddd %s" % (update_owner))
           owner_write.create({'vehicle': self.id, 'owners': vals['customer_name']})
        res = super(Vehiclenum, self).write(vals)
        
        return res

    @api.multi
    def create_owners(self):
        ownership=self.env['ownership']
        _logger.info("send %s,%s" %(self.customer_name,self.id))
        ownership.create({
                    'vehicle': self.id,
                    'owners' : self.customer_name.id
                })
        return True


    model=fields.Char(String='MODEL')
    variant=fields.Char(String='Variant')
    year=fields.Date(String='Year')
    sub_model=fields.Char(String='SUB MODEL')
    category=fields.Selection([('two','Dead Front'),('line front','Line Front')],'FRONT AXLE')
    pos_order_count = fields.Integer(
        compute='_compute_pos_order',
        help="The number of point of sales orders related to this vehicle",
        groups="point_of_sale.group_pos_user",
    )

    def _compute_pos_order(self):
        vehicles_data = self.env['pos.order'].read_group([('vehicle_id', 'in', self.ids)], ['vehicle_id'], ['vehicle_id'])
        _logger.info("veh data %s" %vehicles_data)
        mapped_data = dict([(vehicle['vehicle_id'][0], vehicle['vehicle_id_count']) for vehicle in vehicles_data])
        _logger.info("mapped_data data %s" %mapped_data)
        for vehicle in self:
            vehicle.pos_order_count = mapped_data.get(vehicle.id, 0)

    opportunity_ids = fields.One2many('crm.lead', 'vehicle_id', string='Opportunities', domain=[('type', '=', 'opportunity')])
    opportunity_count = fields.Integer("Opportunity", compute='_compute_opportunity_count')

    @api.multi
    def _compute_opportunity_count(self):
        for vehicle in self:
            #operator = 'child_of' if vehicle.customer_name.is_company else '='  # the opportunity count should counts the opportunities of this company and all its contacts
            operator = '='
            vehicle.opportunity_count = self.env['crm.lead'].search_count([('vehicle_id', operator, vehicle.id), ('type', '=', 'opportunity')])

    active = fields.Boolean(
        'Active', default=True,
        help="If unchecked, it will allow you to hide the vehicle without removing it.")
    meeting_count = fields.Integer("# Meetings", compute='_compute_meeting_count')
    meeting_ids = fields.Many2many('calendar.event', 'calendar_event_pos_vehicle_rel', 'vehicle_id', 'calendar_event_id', string='Meetings', copy=False)
    @api.multi
    def _compute_meeting_count(self):
        for vehicle in self:
            vehicle.meeting_count = len(vehicle.meeting_ids)

    @api.multi
    def schedule_meeting(self):
        _logger.info("schedule:%s" %self._context)
        vehicle_ids =self.ids
        action = self.env.ref('calendar.action_calendar_event').read()[0]
        action['context'] = {
            'default_vehicle_ids': vehicle_ids,
        }
        return action

#Vehicle ownership History maintenence

class ownership(models.Model):
    _name='ownership'
    vehicle=fields.Many2one('pos.vehicle', readonly=True,String="Vehicle Details")
    owners=fields.Many2one('res.partner',String="Owner Details",readonly=True)
    reg_date= fields.Date(string='Register Date',required=True,default=lambda self: self._context.get('date', fields.Date.context_today(self)))
    exp_date= fields.Date(string='Expired Date')

