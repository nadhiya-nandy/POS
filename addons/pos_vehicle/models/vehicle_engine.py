###################################################################################
#
#    Shorepointsystem Private Limited
#    Author: Roja (3-10-18)
#
#
###################################################################################

from odoo import api, fields, models, tools

#Vehicle Engine Specifications
class VehicleModel(models.Model):
    _name = 'vehicle.engine'
    _description = 'Engine Specifications'
    _order = 'name asc'

    name = fields.Char('Name', required=True)
    engine_type = fields.Char('Type', required=True)
    displacement = fields.Char('Displacement(cc)')
    power = fields.Char('Power(ps @ rpm)')
    torque = fields.Char('Torque(Nm @ rpm)')
    transmission = fields.Selection([('manual','Manual'),('automatic','Automatic')],'Transmission')
    cylinder_no = fields.Char('Number of Cylinders')
    gear_no = fields.Char('Number of Gears')
    fuel_tank_capacity = fields.Char('Fuel Tank Capacity(Litres)')
    fuel_type = fields.Selection([('petrol','Petrol'),('diesel','Diesel'),('cng','CNG'),('lpg','LPG')],'Fuel Type')
    mileage = fields.Char('Mileage(km/l)')
    front_brake_type =fields.Char('Front Brake Type')
    rear_brake_type=fields.Char('Rear Brake Type')
    front_suspension =fields.Char('Front Suspension')
    rear_suspension=fields.Char('Rear Suspension')
    steering_type=fields.Char('Steering Type')
    vehicle_model_id = fields.Many2one('vehicle.model', 'Model', help='Variant of the vehicle')
    image = fields.Binary(string="Logo")
    image_medium = fields.Binary(string="Logo (medium)")
    image_small = fields.Binary(string="Logo (small)")

    @api.multi
    @api.depends('name', 'vehicle_model_id')
    def name_get(self):
        res = []
        for record in self:
            name = record.name
            if record.vehicle_model_id.name:
                name = record.vehicle_model_id.name + '/' + name
            res.append((record.id, name))
        return res

    @api.onchange('vehicle_model_id')
    def _onchange_brand(self):
        if self.vehicle_model_id:
            self.image_medium = self.vehicle_model_id.image
        else:
            self.image_medium = False



