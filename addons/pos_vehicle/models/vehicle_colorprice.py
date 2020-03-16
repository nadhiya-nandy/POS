###################################################################################
#
#    Shorepointsystem Private Limited
#    Author: Roja (3-10-18)
#
#
###################################################################################

from odoo import api, fields, models, tools

#Vehicle Color Specifications 
class VehicleModel(models.Model):
    _name = 'vehicle.color'
    _description = 'Vehicle Colors And Prices'
    _order = 'name asc'

    name = fields.Char('Color', required=True)
    image_medium = fields.Binary(string="Logo (medium)")
    vehicle_model_id = fields.Many2one('vehicle.model', 'Model', help='Variant of the vehicle')
    variant_id = fields.Many2one('vehicle.variant', 'Variant',  help='Model Variant')
    price = fields.Float(help='Cost of the Vehicle')

    @api.model 
    def create(self, vals):
        tools.image_resize_images(vals) 
        return super(VehicleModel, self).create(vals)

    @api.onchange('vehicle_model_id')
    def onchange_model(self):
        res = {}
        if self.vehicle_model_id:
           res['domain'] = {'variant_id': [('vehicle_model_id', '=', self.vehicle_model_id.id)]}
        return res
